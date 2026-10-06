import ctypes
import json
import os
from pathlib import Path
import select
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import control


class SourceSnapshotTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.checkout = self.root / "checkout"
        self.client = self.checkout / "client"
        (self.client / "src").mkdir(parents=True)
        self.source = self.client / "src" / "page.tsx"
        self.source.write_text("export const title = 'Meeting';\n")

    def test_typescript_build_metadata_does_not_change_source_fingerprint(self):
        original = control.fingerprint(self.checkout, ("client",))
        for name in ("tsconfig.tsbuildinfo", "src/compiled.tsbuildinfo"):
            with self.subTest(cache=name):
                cache = self.client / name
                cache.write_text('{"version":"first build"}')
                self.assertEqual(control.fingerprint(self.checkout, ("client",)), original)
                cache.write_text('{"version":"rebuilt"}')
                self.assertEqual(control.fingerprint(self.checkout, ("client",)), original)
        self.source.write_text("export const title = 'Changed meeting';\n")
        self.assertNotEqual(control.fingerprint(self.checkout, ("client",)), original)

    def test_source_copy_omits_incremental_metadata_but_keeps_source(self):
        for name in ("tsconfig.tsbuildinfo", "src/compiled.tsbuildinfo"):
            (self.client / name).write_text("generated incremental state")
        source_with_similar_name = self.client / "src" / "cache.tsbuildinfo.ts"
        source_with_similar_name.write_text("export const metadata = true;\n")
        snapshot = self.root / "snapshot"
        shutil.copytree(self.checkout, snapshot, ignore=control.ignore)
        self.assertEqual(list(snapshot.rglob("*.tsbuildinfo")), [])
        self.assertEqual((snapshot / "client/src/page.tsx").read_text(), self.source.read_text())
        self.assertEqual((snapshot / "client/src/cache.tsbuildinfo.ts").read_text(), source_with_similar_name.read_text())
        self.assertEqual(control.fingerprint(snapshot, ("client",)), control.fingerprint(self.checkout, ("client",)))


class BackendCutoffTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.run = Path(temporary.name)
        (self.run / "evidence").mkdir()
        self.state = {"kind": "where2meet-verification-v1", "run_dir": str(self.run), "status": "ready",
                      "source_fingerprint": "frozen", "processes": {"backend": {"pid": 1234, "identity": "owned"}}}
        control.save(self.run, self.state)

    def test_cutoff_retains_database_and_has_an_idempotent_read_only_check(self):
        with patch.object(control, "doctor"), patch.object(control, "process_identity", side_effect=["owned", ""]), \
                patch.object(control.os, "getpgid", return_value=1234), patch.object(control.os, "killpg") as kill, \
                patch.object(control, "wait_for"), patch.object(control, "require_owned_listener") as listener:
            control.stop_backend(self.run)
        kill.assert_called_once_with(1234, signal.SIGTERM)
        listener.assert_called_once()
        self.assertEqual(listener.call_args.args[1], "postgres")
        self.assertEqual(listener.call_args.args[0]["processes"]["backend"]["pid"], 1234)
        self.assertEqual(control.load(self.run)["status"], "backend-stopped")
        self.assertFalse(json.loads((self.run / "evidence/backend-stop.json").read_text())["promise_settlement_claimed"])
        with patch.object(control, "process_identity", return_value=""), patch.object(control, "group_members", return_value=[]), \
                patch.object(control.os, "killpg") as kill:
            control.stop_backend(self.run)
        kill.assert_not_called()

    def test_changed_pid_is_never_signaled(self):
        with patch.object(control, "doctor"), patch.object(control, "process_identity", return_value="reused"), \
                patch.object(control.os, "killpg") as kill:
            with self.assertRaisesRegex(RuntimeError, "ownership changed"):
                control.stop_backend(self.run)
        kill.assert_not_called()

    def test_surviving_group_fails_and_does_not_record_cutoff(self):
        with patch.object(control, "doctor"), patch.object(control, "process_identity", return_value="owned"), \
                patch.object(control.os, "getpgid", return_value=1234), patch.object(control.os, "killpg"), \
                patch.object(control, "wait_for", side_effect=RuntimeError("backend shutdown did not finish")):
            with self.assertRaisesRegex(RuntimeError, "shutdown"):
                control.stop_backend(self.run)
        self.assertFalse((self.run / "evidence/backend-stop.json").exists())
        self.assertEqual(control.load(self.run)["status"], "ready")

    def test_recheck_rejects_surviving_group_or_reused_pid(self):
        self.state["status"] = "cleaned"
        control.save(self.run, self.state)
        control.write_json(self.run / "evidence/backend-stop.json", {
            "status": "PASS", "pid": 1234, "identity": "owned", "source_fingerprint": "frozen"})
        for identity, members in (("reused", []), ("", [5678])):
            with self.subTest(identity=identity), patch.object(control, "process_identity", return_value=identity), \
                    patch.object(control, "group_members", return_value=members), patch.object(control.os, "killpg") as kill:
                with self.assertRaisesRegex(RuntimeError, "present"):
                    control.stop_backend(self.run)
                kill.assert_not_called()

    def test_recheck_rejects_missing_or_wrong_receipt(self):
        self.state["status"] = "backend-stopped"
        control.save(self.run, self.state)
        with self.assertRaises(FileNotFoundError):
            control.stop_backend(self.run)
        control.write_json(self.run / "evidence/backend-stop.json", {"status": "PASS", "pid": 999})
        with self.assertRaisesRegex(RuntimeError, "receipt"):
            control.stop_backend(self.run)


@unittest.skipUnless(shutil.which(control.LISTENER_TOOL), "Listener inspection tool is unavailable")
class ListenerOwnershipTest(unittest.TestCase):
    def setUp(self):
        self.processes = []

    def tearDown(self):
        for process in reversed(self.processes):
            process.stdin.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=5)
            process.stdout.close()
            process.stderr.close()

    def listener(self, child=False, name=""):
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "--listener", "child" if child else "direct", name],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, start_new_session=True)
        self.processes.append(process)
        self.assertTrue(select.select([process.stdout], [], [], 5)[0], "Listener did not report readiness")
        details = json.loads(process.stdout.readline())
        self.assertEqual(os.getpgid(details["pid"]), process.pid)
        state = {"ports": {"frontend": details["port"]}, "processes": {"frontend": {
            "pid": process.pid, "identity": control.process_identity(process.pid)}}}
        return state, details

    def test_owned_listener_passes_and_foreign_listener_is_rejected(self):
        owned, _ = self.listener()
        foreign, _ = self.listener()
        control.require_owned_listener(owned, "frontend")
        wrong = {**owned, "ports": foreign["ports"]}
        with self.assertRaisesRegex(RuntimeError, "not owned"):
            control.require_owned_listener(wrong, "frontend")
        control.require_owned_listener(owned, "frontend")

    def test_child_listener_in_owned_process_group_passes(self):
        state, details = self.listener(child=True)
        self.assertNotEqual(details["pid"], state["processes"]["frontend"]["pid"])
        control.require_owned_listener(state, "frontend")
        state["processes"]["frontend"]["identity"] = "a different process"
        with self.assertRaisesRegex(RuntimeError, "identity does not match"):
            control.require_owned_listener(state, "frontend")

    def test_non_listening_port_fails_closed(self):
        state, _ = self.listener()
        with socket.socket() as closed:
            closed.bind(("127.0.0.1", 0))
            state["ports"]["frontend"] = closed.getsockname()[1]
            with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                control.require_owned_listener(state, "frontend")

    def test_ss_rejects_empty_opaque_and_mixed_ownership_rows(self):
        state, details = self.listener()
        foreign, other = self.listener()
        row = f'LISTEN 0 128 127.0.0.1:{details["port"]} 0.0.0.0:*'
        owned = row + f' users:(("owned",pid={details["pid"]},fd=3))'
        wrong = row + f' users:(("owned",pid={details["pid"]},fd=3),("foreign",pid={other["pid"]},fd=4))'
        with patch.object(control, "LISTENER_TOOL", "ss"):
            with patch.object(control.subprocess, "check_output", return_value=owned):
                control.require_owned_listener(state, "frontend")
            for output in ("", row, owned + "\n" + row, wrong):
                with self.subTest(output=output), patch.object(control.subprocess, "check_output", return_value=output):
                    with self.assertRaises(RuntimeError):
                        control.require_owned_listener(state, "frontend")
        control.require_owned_listener(foreign, "frontend")

    @unittest.skipUnless(sys.platform.startswith("linux"), "Linux process-name regression")
    def test_linux_next_server_name_remains_owned(self):
        state, details = self.listener(child=True, name="next-server (v1")
        self.assertEqual((Path("/proc") / str(details["pid"]) / "comm").read_text().strip(), "next-server (v1")
        control.require_owned_listener(state, "frontend")
        foreign, _ = self.listener()
        with self.assertRaisesRegex(RuntimeError, "not owned"):
            control.require_owned_listener({**foreign, "ports": state["ports"]}, "frontend")


def run_listener(mode, name):
    if mode == "child":
        return subprocess.call([sys.executable, str(Path(__file__).resolve()), "--listener", "direct", name])
    if name:
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(15, name.encode(), 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "Could not set test process name")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        print(json.dumps({"pid": os.getpid(), "port": listener.getsockname()[1]}), flush=True)
        sys.stdin.read()
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == ["--listener"]:
        sys.exit(run_listener(sys.argv[2], sys.argv[3]))
    unittest.main()
