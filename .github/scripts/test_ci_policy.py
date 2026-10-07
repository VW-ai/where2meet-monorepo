import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("ci_policy.py")
BACKEND = "4112712b256284c2b2d298adbcc97b214551d2f2"
FRONTEND = "05e6daa2245e31dfd142768b545b74cdb9a51476"


class PolicyCLI(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.summary = self.directory / "summary.md"
        self.needs = {
            "lint": {"result": "success", "outputs": {}},
            "build": {"result": "success", "outputs": {}},
            "test": {"result": "success", "outputs": {}},
            "client": {"result": "success", "outputs": {}},
            "browser-compat": {"result": "success", "outputs": {}},
            "workflow-lint": {"result": "success", "outputs": {}},
            "staging": {"result": "success", "outputs": {}},
        }
        self.documents = {
            "doctor": {
                "status": "PASS", "source_commit": BACKEND, "frontend_commit": FRONTEND,
                "source_status": "", "frontend_status": "", "mocks": "off",
                "process_ownership": "verified", "schema_mode": "migrations", "backend_mode": "compiled",
            },
            "result": {"status": "PASS", "source_commit": BACKEND, "frontend_commit": FRONTEND,
                       "backend_mode": "compiled", "feature": "event-lifecycle"},
            "cleanup": {"status": "cleaned", "issues": []},
        }

    def invoke(self, *arguments):
        self.summary.unlink(missing_ok=True)
        return subprocess.run(
            [sys.executable, str(SCRIPT), *arguments],
            env={**os.environ, "GITHUB_STEP_SUMMARY": str(self.summary)},
            text=True, capture_output=True, check=False,
        )

    def run_gate(self, needs, event_name="pull_request"):
        return self.invoke("gate", "--needs-json", json.dumps(needs), "--event-name", event_name)

    def write_evidence(self):
        for name, document in self.documents.items():
            (self.directory / f"{name}.json").write_text(json.dumps(document), encoding="utf-8")

    def run_evidence(self, backend=BACKEND, frontend=FRONTEND, scenario="event-lifecycle"):
        return self.invoke("evidence", "--evidence-dir", str(self.directory),
                           "--backend-sha", backend, "--frontend-sha", frontend, "--scenario", scenario)

    def assert_rejected(self, result, operation):
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(result.stdout.splitlines()[0], f"CI {operation}: FAIL")
        self.assertEqual(self.summary.read_text(), result.stdout)

    def test_gate_accepts_complete_success_and_writes_safe_summary(self):
        self.needs["lint"]["outputs"] = {"untrusted": "<script>secret</script>"}
        result = self.run_gate(self.needs)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, """CI gate: PASS

| Workload | Result |
| --- | --- |
| lint | success |
| build | success |
| test | success |
| client | success |
| browser-compat | success |
| workflow-lint | success |
| staging | success |
""")
        self.assertEqual(self.summary.read_text(), result.stdout)

    def test_gate_rejects_each_unsuccessful_workload(self):
        for name in self.needs:
            for outcome in ("failure", "cancelled", "skipped", "neutral", "", True, None):
                with self.subTest(name=name, outcome=outcome):
                    needs = json.loads(json.dumps(self.needs))
                    needs[name]["result"] = outcome
                    self.assert_rejected(self.run_gate(needs), "gate")

    def test_gate_requires_staging_for_pr_and_skips_it_for_other_events(self):
        for event_name in ("push", "merge_group", "workflow_dispatch"):
            with self.subTest(event_name=event_name):
                needs = json.loads(json.dumps(self.needs))
                needs["staging"]["result"] = "skipped"
                self.assertEqual(self.run_gate(needs, event_name).returncode, 0)
                self.assert_rejected(self.run_gate(self.needs, event_name), "gate")
        needs = json.loads(json.dumps(self.needs))
        needs["staging"]["result"] = "skipped"
        self.assert_rejected(self.run_gate(needs), "gate")
        self.assert_rejected(self.run_gate(self.needs, "workflow_run"), "gate")

    def test_gate_rejects_missing_and_extra_workloads(self):
        for name in self.needs:
            with self.subTest(missing=name):
                needs = {key: value for key, value in self.needs.items() if key != name}
                self.assert_rejected(self.run_gate(needs), "gate")
        self.needs["untrusted\n::notice::message"] = {"result": "success"}
        result = self.run_gate(self.needs)
        self.assert_rejected(result, "gate")
        self.assertIn("Unexpected workload keys present.", result.stdout)
        self.assertNotIn("::notice::", result.stdout)

    def test_gate_rejects_malformed_payloads_without_echoing_them(self):
        for payload in ("{secret", "[]", "null", '"secret"'):
            with self.subTest(payload=payload):
                result = self.invoke("gate", "--needs-json", payload, "--event-name", "pull_request")
                self.assert_rejected(result, "gate")
                self.assertEqual(result.stdout, "CI gate: FAIL\n\nMalformed needs JSON.\n")
        for job in ({}, [], {"result": ["success"]}, {"result": "success\n::notice::secret"}):
            with self.subTest(job=job):
                self.needs["test"] = job
                result = self.run_gate(self.needs)
                self.assert_rejected(result, "gate")
                self.assertIn("| test | invalid |", result.stdout)
                self.assertNotIn("secret", result.stdout)

    def test_evidence_accepts_matching_pass_and_cleaned_run(self):
        self.write_evidence()
        result = self.run_evidence()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, """CI evidence: PASS

Backend commit `4112712b256284c2b2d298adbcc97b214551d2f2`.
Frontend commit `05e6daa2245e31dfd142768b545b74cdb9a51476`.
Browser evidence matches both commits and cleanup completed.
""")
        self.assertEqual(self.summary.read_text(), result.stdout)

    def test_evidence_rejects_missing_or_malformed_files(self):
        for name in self.documents:
            for contents in (None, "{", "[]", "null", "\xff"):
                with self.subTest(name=name, contents=contents):
                    self.write_evidence()
                    path = self.directory / f"{name}.json"
                    if contents is None:
                        path.unlink()
                    else:
                        path.write_bytes(contents.encode("latin-1"))
                    self.assert_rejected(self.run_evidence(), "evidence")

    def test_evidence_rejects_stale_backend_and_frontend_identities(self):
        for name, field in (("doctor", "source_commit"), ("doctor", "frontend_commit"),
                            ("result", "source_commit"), ("result", "frontend_commit")):
            with self.subTest(name=name, field=field):
                previous = self.documents[name][field]
                self.documents[name][field] = "9" * 40
                self.write_evidence()
                result = self.run_evidence()
                self.assert_rejected(result, "evidence")
                self.assertIn(f"{name}.json has invalid {field}", result.stdout)
                self.documents[name][field] = previous

    def test_accounts_requires_its_own_browser_result(self):
        self.write_evidence()
        rejected = self.run_evidence(scenario="accounts")
        self.assert_rejected(rejected, "evidence")
        self.assertIn("result.json has invalid feature", rejected.stdout)
        self.documents["result"]["feature"] = "accounts"
        self.write_evidence()
        accepted = self.run_evidence(scenario="accounts")
        self.assertEqual(accepted.returncode, 0, accepted.stderr)
        self.assertEqual(accepted.stdout.splitlines()[0], "CI evidence: PASS")
        self.assert_rejected(self.run_evidence(), "evidence")

    def test_evidence_rejects_failed_and_unfinished_runs(self):
        for name, field, value in (
            ("doctor", "status", "FAIL"), ("result", "status", "FAIL"),
            ("result", "status", "running"), ("cleanup", "status", "cleanup-incomplete"),
            ("cleanup", "status", "ready"), ("cleanup", "issues", ["owned process still alive"]),
            ("cleanup", "issues", None),
        ):
            with self.subTest(name=name, field=field, value=value):
                previous = self.documents[name][field]
                self.documents[name][field] = value
                self.write_evidence()
                self.assert_rejected(self.run_evidence(), "evidence")
                self.documents[name][field] = previous

    def test_evidence_rejects_dirty_sources_and_wrong_modes(self):
        for name, field, value in (
            ("doctor", "source_status", " M server/src/index.ts\n"),
            ("doctor", "frontend_status", " M client/package.json\n"),
            ("doctor", "mocks", "on"), ("doctor", "process_ownership", "unknown"),
            ("doctor", "schema_mode", "push"), ("doctor", "backend_mode", "source"),
            ("result", "backend_mode", "source"),
        ):
            with self.subTest(name=name, field=field):
                previous = self.documents[name][field]
                self.documents[name][field] = value
                self.write_evidence()
                self.assert_rejected(self.run_evidence(), "evidence")
                self.documents[name][field] = previous

    def test_evidence_requires_every_identity_mode_and_cleanup_field(self):
        for name, document in self.documents.items():
            for field in list(document):
                with self.subTest(name=name, field=field):
                    previous = document.pop(field)
                    self.write_evidence()
                    self.assert_rejected(self.run_evidence(), "evidence")
                    document[field] = previous

    def test_evidence_rejects_invalid_expected_identity(self):
        self.write_evidence()
        for backend, frontend in (("", FRONTEND), (BACKEND, "05e6daa"), ("x" * 40, FRONTEND)):
            with self.subTest(backend=backend, frontend=frontend):
                self.assert_rejected(self.run_evidence(backend, frontend), "evidence")


if __name__ == "__main__":
    unittest.main()
