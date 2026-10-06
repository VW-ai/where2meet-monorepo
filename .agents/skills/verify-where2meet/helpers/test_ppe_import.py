import copy
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import ppe
import ppe_import


BACKEND = "11111111-1111-1111-1111-111111111111"
POSTGRES = "22222222-2222-2222-2222-222222222222"
REDIS = "33333333-3333-3333-3333-333333333333"
VOLUME = "55555555-5555-5555-5555-555555555555"
OTHER_VOLUME = "66666666-6666-6666-6666-666666666666"
PROTECTED = (
    "27346658-ce2f-4da5-a999-7c4cb549f9a0",
    "d1eaf58e-bcdf-4717-8a67-33874c907739",
    "6e5789ef-1f5d-4084-bcf4-24bb8591f94d",
)


def target():
    return {
        "kind": "where2meet-ppe-target-v1",
        "railway": {
            "project_id": ppe.PROJECT, "environment_id": ppe.ENVIRONMENT, "environment_name": "ppe",
            "backend_service_id": BACKEND, "postgres_service_id": POSTGRES, "redis_service_id": REDIS,
            "deployment_id": "44444444-4444-4444-4444-444444444444", "backend_origin": "https://owned.example.test",
        },
        "frontend": {"revision": "a" * 40, "origin": "http://127.0.0.1:4317"},
        "source": {"revision": "b" * 40, "server_tree_digest": "c" * 64, "uploaded_artifact_digest": "d" * 64},
    }


def setup_owner():
    return {
        "kind": "where2meet-m5-resource-owner-v1", "project": ppe.PROJECT, "environment": ppe.ENVIRONMENT,
        "setup_dir": "/private/tmp/synthetic-import-setup", "status": "accepted",
        "initial_service_ids": list(PROTECTED), "source": target()["source"],
        "backend_origin": "https://owned.example.test",
        "uploaded_deployment_id": "44444444-4444-4444-4444-444444444444",
        "upload": [{"deploymentId": "44444444-4444-4444-4444-444444444444"}],
        "actions": [
            {"intent": "create empty backend named m5-import-0123456789-backend", "status": "returned"},
            {"intent": "create empty postgres named m5-import-0123456789-postgres", "status": "returned"},
            {"intent": "create empty redis named m5-import-0123456789-redis", "status": "returned"},
        ],
        "services": {
            "backend": {"id": BACKEND, "name": "m5-import-0123456789-backend",
                        "deployment": {"id": "44444444-4444-4444-4444-444444444444", "status": "SUCCESS"},
                        "deployment_provenance": {"image_digest": "sha256:" + "f" * 64}},
            "postgres": {"id": POSTGRES, "name": "m5-import-0123456789-postgres", "volume_id": VOLUME,
                         "planned_volume_mount_path": "/var/lib/postgresql/data", "deployment": {"status": "SUCCESS"}},
            "redis": {"id": REDIS, "name": "m5-import-0123456789-redis", "deployment": {"status": "SUCCESS"}},
        },
    }


def private_file(path, value):
    path.write_text(json.dumps(value))
    path.chmod(0o600)


def owned_run(directory):
    run = directory / "run"
    run.mkdir(mode=0o700)
    (run / "evidence").mkdir()
    (run / "runtime").mkdir(mode=0o700)
    (run / "runtime/retain-until-disposal").write_text("private runtime")
    manifest = target()
    raw = setup_owner()
    raw["setup_dir"] = str(directory)
    owner = ppe_import.canonical_owner(raw, manifest)
    controller = {"pid": 901234, "identity": "original controller start"}
    consumer = {"kind": "where2meet-remote-import-consumer-v1", "run_dir": str(run), "run_id": "one-import",
                "owner_digest": owner["setup_digest"], "controller": controller}
    state = {
        "kind": "where2meet-remote-import-run-v1", "run_dir": str(run), "run_id": "one-import", "status": "ready",
        "owner": owner, "initial_target": manifest, "target": manifest, "target_digest": ppe.digest(manifest),
        "controller": controller, "resource_consumer": consumer, "consumer_path": str(directory / "import-consumer.json"),
        "source_copy": str(run / "runtime/app"), "ports": {"frontend": 4317},
        "backend_url": "https://owned.example.test", "client_url": "http://127.0.0.1:4317",
        "processes": {}, "resource_actions": [],
    }
    private_file(run / "resource-owner.json", raw)
    private_file(directory / "import-consumer.json", consumer)
    private_file(run / "run.json", state)
    return run, state


class FakeRailway:
    def __init__(self):
        self.services = {
            BACKEND: "m5-import-0123456789-backend", POSTGRES: "m5-import-0123456789-postgres",
            REDIS: "m5-import-0123456789-redis",
            **{identifier: f"accepted-{index}" for index, identifier in enumerate(PROTECTED)},
        }
        self.instances = {
            identifier: {
                "id": f"instance-{index}", "serviceId": identifier, "environmentId": ppe.ENVIRONMENT,
                "source": {"image": "fixed-image", "repo": None}, "domains": {"serviceDomains": [], "customDomains": []},
                "latestDeployment": {"id": f"deployment-{index}", "status": "SUCCESS",
                                     "meta": {"imageDigest": "sha256:" + "f" * 64},
                                     "instances": [{"id": f"runtime-{index}", "status": "RUNNING"}]},
            } for index, identifier in enumerate(self.services)
        }
        self.volumes = [
            {"id": VOLUME, "serviceName": "m5-import-0123456789-postgres", "deletedAt": None,
             "isPendingDeletion": False, "mountPath": "/var/lib/postgresql/data"},
            {"id": OTHER_VOLUME, "serviceName": "accepted-1", "deletedAt": None,
             "isPendingDeletion": False, "mountPath": "/accepted-data"},
        ]
        self.foreign_instances = []
        self.project_id = ppe.PROJECT
        self.environment_id = ppe.ENVIRONMENT
        self.volume_project = "where2meet-server"
        self.volume_environment = "ppe"
        self.lost_replies = set()
        self.refused_deletions = set()
        self.pending_volume = False
        self.retain_project_services = False
        self.deleted = []

    def status(self):
        environments = [{"node": {"id": self.environment_id, "name": "ppe",
                                   "serviceInstances": {"edges": [{"node": entry} for entry in self.instances.values()]}}}]
        if self.foreign_instances:
            environments.append({"node": {"id": "99999999-9999-9999-9999-999999999999", "name": "production",
                                           "serviceInstances": {"edges": [{"node": entry} for entry in self.foreign_instances]}}})
        return {"id": self.project_id, "name": "where2meet-server", "services": {"edges": [{"node": {"id": key, "name": value}}
                                                                  for key, value in self.services.items()]},
                "environments": {"edges": environments}}

    def __call__(self, state, operation, role=None, mutation=None):
        if operation == ["status", "--json"]:
            return copy.deepcopy(self.status())
        if operation == ["volume", "list", "--json"]:
            return copy.deepcopy({"environment": self.volume_environment, "project": self.volume_project, "volumes": self.volumes})
        if operation == ["service", "delete", "--yes", "--json"] and role in ("backend", "postgres", "redis"):
            identifier = state["owner"]["services"][role]["id"]
            if identifier in self.refused_deletions:
                raise RuntimeError("provider did not confirm deletion")
            if identifier not in self.instances:
                raise AssertionError("An absent service was deleted again")
            del self.instances[identifier]
            if not self.retain_project_services:
                del self.services[identifier]
            if identifier == POSTGRES:
                for volume in self.volumes:
                    if volume["id"] == VOLUME:
                        volume["serviceName"] = None
        elif operation == ["volume", "delete", "--volume", VOLUME, "--yes", "--json"] and role is None:
            identifier = VOLUME
            if identifier in self.refused_deletions:
                raise RuntimeError("provider did not confirm deletion")
            if not any(volume["id"] == identifier for volume in self.volumes):
                raise AssertionError("An absent volume was deleted again")
            if self.pending_volume:
                next(volume for volume in self.volumes if volume["id"] == VOLUME)["isPendingDeletion"] = True
            else:
                self.volumes = [volume for volume in self.volumes if volume["id"] != identifier]
        else:
            raise AssertionError("Unexpected provider operation")
        self.deleted.append(identifier)
        if identifier in self.lost_replies:
            self.lost_replies.remove(identifier)
            raise RuntimeError("connection closed after accepted deletion")
        return {"success": True}


class OwnerBoundaryTest(unittest.TestCase):
    def test_receipt_selects_only_the_new_trio_and_owned_volume(self):
        result = ppe_import.canonical_owner(setup_owner(), target())
        self.assertEqual(result["services"], {
            "backend": {"id": BACKEND, "name": "m5-import-0123456789-backend"},
            "postgres": {"id": POSTGRES, "name": "m5-import-0123456789-postgres"},
            "redis": {"id": REDIS, "name": "m5-import-0123456789-redis"},
        })
        self.assertEqual(result["postgres_volume_id"], VOLUME)
        self.assertEqual(result["initial_service_ids"], sorted(PROTECTED))

    def test_receipt_rejects_protected_existing_and_different_target_services(self):
        for identifier in (PROTECTED[0], "77777777-7777-7777-7777-777777777777"):
            with self.subTest(identifier=identifier):
                raw = setup_owner()
                raw["services"]["backend"]["id"] = identifier
                with self.assertRaises(RuntimeError):
                    ppe_import.canonical_owner(raw, target())
        raw = setup_owner()
        raw["initial_service_ids"].append(BACKEND)
        with self.assertRaises(RuntimeError):
            ppe_import.canonical_owner(raw, target())

    def test_receipt_rejects_other_environment_project_role_and_trio(self):
        mutations = (
            lambda raw: raw.update(environment="production"),
            lambda raw: raw.update(project="different-project"),
            lambda raw: raw["services"].update(worker={"id": "77777777-7777-7777-7777-777777777777"}),
            lambda raw: raw["services"]["redis"].update(name="m5-import-9876543210-redis"),
            lambda raw: raw["services"]["postgres"].update(planned_volume_mount_path="/other"),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(change=index):
                raw = setup_owner()
                mutate(raw)
                with self.assertRaises(RuntimeError):
                    ppe_import.canonical_owner(raw, target())

    def test_receipt_rejects_changed_source_and_origin(self):
        for field, value in (("source", {**target()["source"], "revision": "e" * 40}),
                             ("backend_origin", "https://unowned.example.test")):
            with self.subTest(field=field):
                raw = setup_owner()
                raw[field] = value
                with self.assertRaises(RuntimeError):
                    ppe_import.canonical_owner(raw, target())

    def test_unconfirmed_creation_or_upload_never_authorizes_resource_disposal(self):
        mutations = (
            lambda raw: raw.update(status="planned"),
            lambda raw: raw.update(status="uploaded-awaiting-inspection"),
            lambda raw: raw.update(setup_dir="relative-directory"),
            lambda raw: raw["actions"][0].update(status="pending"),
            lambda raw: raw["actions"].append(copy.deepcopy(raw["actions"][0])),
            lambda raw: raw["services"]["postgres"]["deployment"].update(status="FAILED"),
            lambda raw: raw.update(upload=[]),
            lambda raw: raw.update(uploaded_deployment_id="77777777-7777-7777-7777-777777777777"),
            lambda raw: raw["services"]["backend"]["deployment_provenance"].update(image_digest="unknown"),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(change=index):
                raw = setup_owner()
                mutate(raw)
                with self.assertRaises(RuntimeError):
                    ppe_import.canonical_owner(raw, target())


class PrivateFileBoundaryTest(unittest.TestCase):
    def test_private_receipt_creation_is_exclusive_and_owner_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "owner.json"
            ppe_import.write_private(path, {"run": "first-owner"})
            self.assertEqual(json.loads(path.read_text()), {"run": "first-owner"})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                ppe_import.write_private(path, {"run": "different-owner"})
            self.assertEqual(json.loads(path.read_text()), {"run": "first-owner"})

    def test_reads_private_regular_json_and_refuses_public_or_linked_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            receipt = directory / "owner.json"
            private_file(receipt, {"run": "owned"})
            self.assertEqual(ppe_import.private_json(receipt), {"run": "owned"})
            receipt.chmod(0o644)
            with self.assertRaises(RuntimeError):
                ppe_import.private_json(receipt)
            receipt.chmod(0o600)
            symbolic = directory / "symbolic.json"
            symbolic.symlink_to(receipt)
            with self.assertRaises(RuntimeError):
                ppe_import.private_json(symbolic)
            hardlink = directory / "hardlink.json"
            os.link(receipt, hardlink)
            with self.assertRaises(RuntimeError):
                ppe_import.private_json(receipt)

    def test_missing_and_malformed_receipts_do_not_become_empty_ownership(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "owner.json"
            with self.assertRaises(FileNotFoundError):
                ppe_import.private_json(path)
            path.write_text("{")
            path.chmod(0o600)
            with self.assertRaises(json.JSONDecodeError):
                ppe_import.private_json(path)


class TunnelBoundaryTest(unittest.TestCase):
    def test_rewrites_only_host_and_port_and_preserves_escaped_synthetic_credentials(self):
        self.assertEqual(
            ppe_import.tunnel_url("postgresql://user%40demo:fake%3Apass@owned.railway.internal:5432/where2meet_import?schema=public", 43219),
            "postgresql://user%40demo:fake%3Apass@127.0.0.1:43219/where2meet_import?schema=public",
        )

    def test_rejects_foreign_authority_database_and_missing_credentials(self):
        urls = (
            "postgresql://user:fake@owned.example.test:5432/where2meet_import",
            "postgresql://user:fake@owned.railway.internal.example.test:5432/where2meet_import",
            "postgresql://user:fake@owned.railway.internal:5433/where2meet_import",
            "postgresql://user:fake@owned.railway.internal:5432/production",
            "postgresql://owned.railway.internal:5432/where2meet_import",
            "https://user:fake@owned.railway.internal:5432/where2meet_import",
            "postgresql://user:fake@owned.railway.internal:5432/where2meet_import#fragment",
        )
        for url in urls:
            with self.subTest(url=url), self.assertRaises(RuntimeError):
                ppe_import.tunnel_url(url, 43219)


class ProcessOwnershipTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.run = Path(self.temporary.name).resolve()
        self.state = {"processes": {}}
        self.old_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.old_umask)
        self.children = []
        self.addCleanup(self.reap_children)

    def reap_children(self):
        for child in self.children:
            if child.stdin and not child.stdin.closed:
                child.stdin.close()
            try:
                child.wait(timeout=2)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=2)

    def test_target_starts_only_after_its_pid_is_durably_recorded(self):
        marker = self.run / "executed.json"
        program = (
            "import json,os,pathlib; "
            "root=pathlib.Path(__import__('sys').argv[1]); "
            "owned=json.loads((root/'run.json').read_text())['processes']['worker']; "
            "(root/'executed.json').write_text(json.dumps({'recorded_pid':owned['pid'],'actual_pid':os.getpid(),'command':owned['command']}))"
        )
        with patch.object(ppe_import, "process_identity", return_value="observed child start"):
            child = ppe_import.start_owned(self.run, self.state, "worker", [sys.executable, "-c", program, str(self.run)], self.run, {})
        self.children.append(child)
        self.assertEqual(child.wait(timeout=5), 0)
        self.assertEqual(json.loads(marker.read_text()), {"recorded_pid": child.pid, "actual_pid": child.pid, "command": ["worker"]})
        self.assertNotIn(program, (self.run / "run.json").read_text())

    def test_failed_ownership_save_never_releases_target_and_reaps_bootstrap(self):
        marker = self.run / "must-not-execute"
        original_popen = subprocess.Popen

        def observed_popen(*args, **kwargs):
            child = original_popen(*args, **kwargs)
            self.children.append(child)
            return child

        with patch.object(ppe_import.subprocess, "Popen", side_effect=observed_popen), \
                patch.object(ppe_import, "process_identity", return_value="observed child start"), \
                patch.object(ppe_import, "save", side_effect=RuntimeError("ownership disk unavailable")):
            with self.assertRaisesRegex(RuntimeError, "ownership disk unavailable"):
                ppe_import.start_owned(self.run, self.state, "worker",
                                       [sys.executable, "-c", "import pathlib,sys;pathlib.Path(sys.argv[1]).touch()", str(marker)], self.run, {})
        self.assertEqual(len(self.children), 1)
        self.children[0].wait(timeout=2)
        self.assertFalse(marker.exists())

    def test_reused_pid_is_refused_without_signaling_the_replacement(self):
        self.state["processes"]["worker"] = {"pid": 812345, "identity": "original start"}
        with patch.object(ppe_import, "process_identity", return_value="replacement start"), \
                patch.object(ppe_import.os, "killpg") as signal_group:
            with self.assertRaisesRegex(RuntimeError, "ownership changed"):
                ppe_import.stop_processes(self.run, self.state, ("worker",))
        signal_group.assert_not_called()

    def test_owned_process_stops_without_affecting_an_unrelated_process(self):
        self.state["processes"]["worker"] = {"pid": 812345, "identity": "original start"}
        live = {812345, 812346}

        def terminate(group, sent_signal):
            self.assertEqual(sent_signal, signal.SIGTERM)
            live.remove(group)

        with patch.object(ppe_import, "process_identity", return_value="original start"), \
                patch.object(ppe_import.os, "getpgid", return_value=812345), \
                patch.object(ppe_import.os, "killpg", side_effect=terminate), \
                patch.object(ppe_import.control, "group_members", side_effect=lambda group: [group] if group in live else []):
            ppe_import.stop_processes(self.run, self.state, ("worker",))
        self.assertEqual(live, {812346})

    def test_missing_leader_with_surviving_children_refuses_cleanup(self):
        self.state["processes"]["worker"] = {"pid": 812345, "identity": "original start"}
        with patch.object(ppe_import, "process_identity", return_value=""), \
                patch.object(ppe_import.control, "group_members", return_value=[812346]), \
                patch.object(ppe_import.os, "killpg") as signal_group:
            with self.assertRaisesRegex(RuntimeError, "surviving process group"):
                ppe_import.stop_processes(self.run, self.state, ("worker",))
        signal_group.assert_not_called()

    def test_process_inspection_distinguishes_a_live_owner_from_confirmed_absence(self):
        for completed, expected in (
            (subprocess.CompletedProcess(["ps"], 0, "Ss Tue Oct  6 10:11:12 2026\n", ""), "Tue Oct  6 10:11:12 2026"),
            (subprocess.CompletedProcess(["ps"], 1, "", ""), ""),
            (subprocess.CompletedProcess(["ps"], 0, "Z Tue Oct  6 10:11:12 2026\n", ""), ""),
        ):
            with self.subTest(status=completed.returncode, output=completed.stdout), \
                    patch.object(ppe_import.subprocess, "run", return_value=completed):
                self.assertEqual(ppe_import.process_identity(812345), expected)

    def test_process_inspection_errors_cannot_be_treated_as_a_dead_owner(self):
        for completed in (
            subprocess.CompletedProcess(["ps"], 2, "", "inspection denied"),
            subprocess.CompletedProcess(["ps"], 1, "", "inspection denied"),
            subprocess.CompletedProcess(["ps"], 1, "unrecognized output", ""),
            subprocess.CompletedProcess(["ps"], 0, "", ""),
        ):
            with self.subTest(status=completed.returncode, output=completed.stdout), \
                    patch.object(ppe_import.subprocess, "run", return_value=completed):
                with self.assertRaisesRegex(RuntimeError, "inspection unavailable"):
                    ppe_import.process_identity(812345)
        with patch.object(ppe_import.subprocess, "run", side_effect=PermissionError("inspection denied")):
            with self.assertRaises(PermissionError):
                ppe_import.process_identity(812345)


class RecoveryBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.old_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.old_umask)
        self.run, self.state = owned_run(Path(self.temporary.name).resolve())
        self.consumer = Path(self.state["consumer_path"])
        self.children = []
        self.addCleanup(self.reap_children)

    def reap_children(self):
        for child in self.children:
            if child.stdin and not child.stdin.closed:
                child.stdin.close()
                child.stdin = None
            try:
                child.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                child.kill()
                child.communicate(timeout=2)

    def test_inactive_controller_recovers_exact_missing_consumer_after_durable_run(self):
        self.consumer.unlink()
        original = (self.run / "run.json").read_bytes()
        with patch.object(ppe_import, "process_identity", return_value=""):
            restored = ppe_import.read_run(self.run)
        self.assertEqual(restored["run_id"], "one-import")
        self.assertEqual(json.loads(self.consumer.read_text()), {
            "kind": "where2meet-remote-import-consumer-v1", "run_dir": str(self.run), "run_id": "one-import",
            "owner_digest": self.state["owner"]["setup_digest"],
            "controller": {"pid": 901234, "identity": "original controller start"},
        })
        self.assertEqual(self.consumer.stat().st_mode & 0o777, 0o600)
        self.assertEqual((self.run / "run.json").read_bytes(), original)
        self.assertEqual(ppe_import.read_run(self.run)["run_id"], "one-import")

    def test_active_controller_keeps_its_unfinished_consumer_claim_exclusive(self):
        self.consumer.unlink()
        original = (self.run / "run.json").read_bytes()
        with patch.object(ppe_import, "process_identity", return_value="original controller start"):
            with self.assertRaisesRegex(RuntimeError, "Active controller"):
                ppe_import.read_run(self.run)
        self.assertFalse(self.consumer.exists())
        self.assertEqual((self.run / "run.json").read_bytes(), original)
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")

    def test_foreign_consumer_is_preserved_and_cannot_mutate_runtime(self):
        foreign = {**self.state["resource_consumer"], "run_id": "foreign-import"}
        private_file(self.consumer, foreign)
        original = (self.run / "run.json").read_bytes()
        with self.assertRaisesRegex(RuntimeError, "consumer receipt changed"):
            ppe_import.read_run(self.run)
        self.assertEqual(json.loads(self.consumer.read_text()), foreign)
        self.assertEqual((self.run / "run.json").read_bytes(), original)
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")

    def test_invalid_durable_claim_cannot_create_an_external_consumer(self):
        self.consumer.unlink()
        self.state["resource_consumer"]["run_id"] = "different-import"
        ppe_import.save(self.run, self.state)
        with patch.object(ppe_import, "process_identity", return_value=""):
            with self.assertRaisesRegex(RuntimeError, "does not own this controller"):
                ppe_import.read_run(self.run)
        self.assertFalse(self.consumer.exists())
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")

    def test_proof_and_cleanup_only_callers_use_the_remote_pipe_held_kernel_lock(self):
        for caller in ("proof", "recovery"):
            with self.subTest(caller=caller):
                self.state["processes"] = {caller: {"pid": os.getpid(), "identity": "observed parent start"}}
                ppe_import.save(self.run, self.state)
                child = subprocess.Popen(
                    [sys.executable, "-c", "import ppe_import; ppe_import.process_identity=lambda pid:'observed parent start'; ppe_import.main()",
                     "hold-import-cleanup", "--run", str(self.run)],
                    cwd=Path(ppe_import.__file__).parent,
                    env={**ppe_import.control.clean_environment(), "PYTHONDONTWRITEBYTECODE": "1"},
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                )
                self.children.append(child)
                readable, _, _ = select.select([child.stdout], [], [], 5)
                self.assertEqual(readable, [child.stdout], "Remote lock holder did not acknowledge startup")
                self.assertEqual(child.stdout.readline(), "IMPORT_CLEANUP_LOCKED\n")
                with self.assertRaises(BlockingIOError):
                    ppe_import.control.acquire_cleanup_lock(self.run)
                child.stdin.close()
                child.stdin = None
                output, errors = child.communicate(timeout=5)
                self.assertEqual((child.returncode, output, errors), (0, "", ""))
                descriptor = ppe_import.control.acquire_cleanup_lock(self.run)
                try:
                    os.ftruncate(descriptor, 0)
                    os.write(descriptor, b"lock recovered")
                finally:
                    os.close(descriptor)
                self.assertEqual((self.run / "migration-cleanup.lock").read_text(), "lock recovered")

    def test_unrecorded_internal_caller_cannot_create_a_cleanup_lock(self):
        result = subprocess.run(
            [sys.executable, "-c", "import ppe_import; ppe_import.main()", "hold-import-cleanup", "--run", str(self.run)],
            cwd=Path(ppe_import.__file__).parent, env={**ppe_import.control.clean_environment(), "PYTHONDONTWRITEBYTECODE": "1"},
            input="", capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("recorded live proof process", result.stderr)
        self.assertFalse((self.run / "migration-cleanup.lock").exists())

    def test_local_lock_entry_point_still_refuses_a_remote_run(self):
        result = subprocess.run(
            [sys.executable, str(Path(ppe_import.control.__file__)), "hold-import-cleanup", "--run", str(self.run)],
            env={**ppe_import.control.clean_environment(), "PYTHONDONTWRITEBYTECODE": "1"}, input="", capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("not an owned Where2Meet verification run", result.stderr)
        self.assertFalse((self.run / "migration-cleanup.lock").exists())


class ResourceDisposalTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.old_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.old_umask)
        self.run, self.state = owned_run(Path(self.temporary.name).resolve())
        self.provider = FakeRailway()
        self.patch_provider = patch.object(ppe_import, "provider", side_effect=self.provider)
        self.patch_provider.start()
        self.addCleanup(self.patch_provider.stop)
        observed = ppe_import.resource_inventory(self.state)
        self.state["accepted_baseline"] = observed["baseline"]
        ppe_import.save(self.run, self.state)

    def test_inventory_accepts_real_volume_envelope_and_scoped_service_ids(self):
        observed = ppe_import.resource_inventory(self.state)
        self.assertEqual(observed["volumes"][0], {
            "id": VOLUME, "serviceName": "m5-import-0123456789-postgres", "deletedAt": None,
            "isPendingDeletion": False, "mountPath": "/var/lib/postgresql/data",
        })
        self.assertEqual(observed["services"][POSTGRES], "m5-import-0123456789-postgres")
        self.assertEqual(set(observed["baseline"]), set(PROTECTED))

    def test_inventory_rejects_other_project_environment_and_foreign_service_placement(self):
        for attribute, value in (("project_id", "other-project"), ("environment_id", "other-environment"),
                                 ("volume_environment", "production"), ("volume_project", "other-project")):
            previous = getattr(self.provider, attribute)
            with self.subTest(attribute=attribute):
                setattr(self.provider, attribute, value)
                with self.assertRaises(RuntimeError):
                    ppe_import.resource_inventory(self.state)
                setattr(self.provider, attribute, previous)
        self.provider.foreign_instances.append(copy.deepcopy(self.provider.instances[POSTGRES]))
        with self.assertRaisesRegex(RuntimeError, "another environment"):
            ppe_import.resource_inventory(self.state)

    def test_owned_volume_cannot_move_to_a_foreign_service_or_detach_while_postgres_exists(self):
        for service in ("accepted-1", "m5-import-0123456789-backend", None):
            with self.subTest(service=service):
                self.provider.volumes[0]["serviceName"] = service
                with self.assertRaises(RuntimeError):
                    ppe_import.resource_inventory(self.state)

    def test_detached_owned_volume_remains_visible_after_postgres_service_absence(self):
        del self.provider.instances[POSTGRES]
        del self.provider.services[POSTGRES]
        self.provider.volumes[0]["serviceName"] = None
        observed = ppe_import.resource_inventory(self.state)
        self.assertEqual(next(volume for volume in observed["volumes"] if volume["id"] == VOLUME)["mountPath"], "/var/lib/postgresql/data")
        self.assertNotIn(POSTGRES, observed["instances"])

    def test_missing_volume_refuses_preflight_but_is_valid_for_disposal_recovery(self):
        self.provider.volumes = [volume for volume in self.provider.volumes if volume["id"] != VOLUME]
        with patch.object(ppe_import.ppe, "inspect_target", return_value=({}, {})):
            with self.assertRaisesRegex(RuntimeError, "volume absent"):
                ppe_import.inspect(self.run, frontend=False)
        result = ppe_import.dispose(self.run)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(self.provider.volumes, [{"id": OTHER_VOLUME, "serviceName": "accepted-1", "deletedAt": None,
                                                "isPendingDeletion": False, "mountPath": "/accepted-data"}])

    def test_lost_delete_replies_converge_to_exact_absence_and_repeated_cleanup_is_safe(self):
        self.provider.lost_replies = {BACKEND, REDIS, POSTGRES, VOLUME}
        failure = self.run / "evidence/migration-result.json"
        private_file(failure, {"status": "FAIL", "failed_stage": "import reply lost"})
        first = ppe_import.dispose(self.run)
        second = ppe_import.dispose(self.run)
        self.assertEqual(first, second)
        self.assertEqual(first["status"], "PASS")
        self.assertEqual(first["service_ids_absent"], [BACKEND, POSTGRES, REDIS])
        self.assertEqual(first["volume_id_absent"], VOLUME)
        self.assertEqual(set(self.provider.services), set(PROTECTED))
        self.assertEqual(set(self.provider.instances), set(PROTECTED))
        self.assertEqual([volume["id"] for volume in self.provider.volumes], [OTHER_VOLUME])
        self.assertCountEqual(self.provider.deleted, [BACKEND, POSTGRES, REDIS, VOLUME])
        self.assertEqual(json.loads(failure.read_text()), {"status": "FAIL", "failed_stage": "import reply lost"})
        self.assertFalse((self.run / "runtime").exists())

    def test_unproven_delete_retains_private_runtime_and_later_cleanup_can_finish(self):
        self.provider.refused_deletions.add(REDIS)
        with self.assertRaisesRegex(RuntimeError, "absence unproven"):
            ppe_import.dispose(self.run)
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")
        self.assertIn(REDIS, self.provider.instances)
        self.assertIn(POSTGRES, self.provider.instances)
        self.assertFalse((self.run / "evidence/resource-cleanup.json").exists())
        self.provider.refused_deletions.clear()
        self.assertEqual(ppe_import.dispose(self.run)["status"], "PASS")
        self.assertEqual(set(self.provider.services), set(PROTECTED))

    def test_pending_volume_deletion_is_not_absence(self):
        self.provider.pending_volume = True
        with self.assertRaisesRegex(RuntimeError, "volume remains"):
            ppe_import.dispose(self.run)
        self.assertTrue(next(volume for volume in self.provider.volumes if volume["id"] == VOLUME)["isPendingDeletion"])
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")
        self.assertFalse((self.run / "evidence/resource-cleanup.json").exists())

    def test_environment_deletion_does_not_claim_project_service_absence(self):
        self.provider.retain_project_services = True
        with self.assertRaisesRegex(RuntimeError, "project service records remain"):
            ppe_import.dispose(self.run)
        self.assertTrue({BACKEND, POSTGRES, REDIS} <= self.provider.services.keys())
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")

    def test_accepted_ppe_metadata_change_refuses_every_resource_delete(self):
        self.provider.instances[PROTECTED[0]]["source"] = {"image": "changed-image"}
        with self.assertRaisesRegex(RuntimeError, "Accepted PPE resource metadata changed"):
            ppe_import.dispose(self.run)
        self.assertEqual(set(self.provider.instances), set(PROTECTED) | {BACKEND, POSTGRES, REDIS})
        self.assertEqual((self.run / "runtime/retain-until-disposal").read_text(), "private runtime")

    def test_changed_resource_consumer_refuses_disposal(self):
        consumer = copy.deepcopy(self.state["resource_consumer"])
        consumer["run_id"] = "another-controller"
        private_file(Path(self.state["consumer_path"]), consumer)
        with self.assertRaisesRegex(RuntimeError, "consumer receipt changed"):
            ppe_import.dispose(self.run)
        self.assertEqual(set(self.provider.instances), set(PROTECTED) | {BACKEND, POSTGRES, REDIS})


class GenerationEnvironmentTest(unittest.TestCase):
    def test_prisma_generation_gets_only_a_dummy_url_without_changing_other_setup_commands(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            repository = directory / "backend"
            frontend = directory / "frontend"
            (repository / "server").mkdir(parents=True)
            (frontend / "client").mkdir(parents=True)
            raw = setup_owner()
            raw["setup_dir"] = str(directory)
            private_file(directory / "ownership.json", raw)
            private_file(directory / "target.json", target())
            args = SimpleNamespace(run=directory / "run", owner=directory / "ownership.json", target=directory / "target.json",
                                   fixture=directory / "fixture", repo=repository, frontend_repo=frontend)
            commands = []

            def source_identity(command, **_kwargs):
                if "status" in command:
                    return ""
                return target()["source" if command[2] == str(repository) else "frontend"]["revision"]

            def setup_command(command, cwd, environment, _log):
                commands.append((command, cwd, dict(environment)))
                if command == ["npx", "prisma", "generate"]:
                    raise RuntimeError("stop after generation boundary")

            ambient = {"PATH": "/synthetic/bin", "HOME": str(directory), "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "synthetic-google",
                       "DATABASE_URL": "postgresql://synthetic:ambient@foreign.example/database", "RAILWAY_TOKEN": "synthetic-provider",
                       "RAILWAY_API_TOKEN": "synthetic-provider", "PPE_SSH_KEY": "/synthetic/key", "PPE_SSH_KNOWN_HOSTS": "/synthetic/hosts"}
            with patch.dict(os.environ, ambient, clear=True), \
                    patch.object(ppe_import.subprocess, "check_output", side_effect=source_identity), \
                    patch.object(ppe_import.control, "fingerprint", return_value=target()["source"]["server_tree_digest"]), \
                    patch.object(ppe_import.ppe, "inspect_target", return_value=({}, {})), \
                    patch.object(ppe_import, "process_owner", return_value={"pid": 12345, "identity": "synthetic controller"}), \
                    patch.object(ppe_import, "resource_inventory", return_value={"baseline": {}}), \
                    patch.object(ppe_import.control, "command", side_effect=setup_command), \
                    patch.object(ppe_import, "cleanup"), patch.object(ppe_import, "start_owned") as launch:
                with self.assertRaisesRegex(RuntimeError, "stop after generation boundary"):
                    ppe_import.verify(args)
            self.assertEqual([entry[0] for entry in commands], [
                ["npm", "ci", "--no-audit", "--no-fund"], ["npm", "ci", "--no-audit", "--no-fund"], ["npx", "prisma", "generate"]])
            self.assertEqual(commands[2][1], args.run / "runtime/app/server")
            self.assertEqual(commands[2][2]["DATABASE_URL"], "postgresql://generation@127.0.0.1:1/where2meet_generate")
            self.assertTrue(all("DATABASE_URL" not in entry[2] for entry in commands[:2]))
            for _command, _cwd, environment in commands:
                self.assertEqual(environment["PATH"], "/synthetic/bin")
                self.assertTrue({"RAILWAY_TOKEN", "RAILWAY_API_TOKEN", "PPE_SSH_KEY", "PPE_SSH_KNOWN_HOSTS", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"}.isdisjoint(environment))
            launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
