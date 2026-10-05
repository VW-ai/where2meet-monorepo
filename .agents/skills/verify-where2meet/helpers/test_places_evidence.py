import json
from contextlib import ExitStack
from types import SimpleNamespace
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import control
import ppe
from test_ppe import provider


class PlacesFailureEvidenceTest(unittest.TestCase):
    def test_verify_cleanup_failure_overrides_pass_and_preserves_prior_failure_and_cleanup_evidence(self):
        for initial_status in ("PASS", "FAIL"):
            with self.subTest(initial_status=initial_status), tempfile.TemporaryDirectory() as temporary, ExitStack() as mocks:
                directory = Path(temporary).resolve()
                frontend, repo, run = directory / "frontend", directory / "backend", directory / "run"
                (frontend / "client").mkdir(parents=True)
                repo.mkdir()
                target = provider()[0]
                target_file = directory / "target.json"
                control.write_json(target_file, target)
                args = SimpleNamespace(run=run, scenario="places-routes", target=target_file, frontend_repo=frontend, repo=repo)

                def git_read(command, **_options):
                    if "status" in command:
                        return ""
                    return target["frontend"]["revision"] if str(frontend) in command else target["source"]["revision"]

                def browser_start(*_args):
                    result = {"status": initial_status, "feature": "places-routes", "scope": ["coffee search"],
                              "error": "prior browser failure retained", "verification_error": "prior check retained"}
                    control.write_json(run / "evidence/result.json", result)
                    control.write_json(run / "evidence/places-state.json", {"stage": "walking", "status": initial_status})
                    return SimpleNamespace(wait=lambda **_kwargs: 0)

                def failed_cleanup(_run):
                    control.write_json(run / "evidence/cleanup.json", {"status": "cleanup-incomplete", "remaining_event_ids": ["evt_fixture"]})
                    raise RuntimeError("Owned event cleanup failed")

                mocks.enter_context(patch.dict(ppe.os.environ, {"NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "fixture-only"}))
                for name, options in [
                    ("subprocess.check_output", {"side_effect": git_read}), ("shutil.which", {"return_value": "/fixture/tool"}),
                    ("socket.socket", {"return_value": MagicMock()}), ("inspect_target", {"return_value": ({}, {})}),
                    ("verifier_fingerprint", {"return_value": "fixture-fingerprint"}),
                    ("control.fingerprint", {"side_effect": lambda _root, packages: "c" * 64 if packages == ("server",) else "e" * 64}),
                    ("control.command", {"return_value": None}), ("launch_frontend", {"return_value": None}),
                    ("doctor", {"return_value": {}}), ("control.start", {"side_effect": browser_start}),
                    ("private_environment", {"return_value": {}}), ("cleanup", {"side_effect": failed_cleanup}),
                ]:
                    mocks.enter_context(patch("ppe." + name, **options))
                with self.assertRaisesRegex(RuntimeError, "Owned event cleanup failed"):
                    ppe.verify(args)
                result = json.loads((run / "evidence/result.json").read_text())
                self.assertEqual(result["status"], "FAIL")
                self.assertEqual(result["cleanup_error"], "Owned event cleanup failed")
                self.assertEqual(result["error"], "prior browser failure retained")
                self.assertEqual(result["verification_error"], "prior check retained")
                self.assertEqual(result["scope"], ["coffee search"])
                self.assertEqual(json.loads((run / "evidence/places-state.json").read_text())["stage"], "walking")
                self.assertEqual(json.loads((run / "evidence/cleanup.json").read_text())["remaining_event_ids"], ["evt_fixture"])

    def test_photo_origin_accepts_explicit_or_railway_origin_without_exposing_bad_values(self):
        for field in ("PUBLIC_API_ORIGIN", "RAILWAY_PUBLIC_DOMAIN"):
            with self.subTest(field=field):
                values = provider()
                values[3][field] = "https://ppe.example.test" if field == "PUBLIC_API_ORIGIN" else "ppe.example.test"
                self.assertEqual(ppe.verify_identity(*values)["public_api_origin"], "https://ppe.example.test")
        values = provider()
        values[3]["PUBLIC_API_ORIGIN"] = "https://user:do-not-print@another.example.test"
        result = ppe.verify_identity(*values)
        self.assertIsNone(result["public_api_origin"])
        self.assertNotIn("do-not-print", json.dumps(result))

    def test_failure_before_browser_result_still_creates_canonical_result(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "evidence").mkdir()
            result = control.write_failure_result(run, "places-routes", "Browser stopped before it saved a result")
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(result["feature"], "places-routes")
            self.assertEqual(result["scope"], [])
            self.assertEqual(json.loads((run / "evidence/result.json").read_text()), result)

    def test_search_detail_and_route_failures_preserve_partial_evidence_and_separate_cleanup(self):
        for stage in ("search", "details", "driving", "walking"):
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as temporary:
                run = Path(temporary)
                (run / "evidence").mkdir()
                original = {"status": "PASS", "feature": "places-routes", "scope": ["two persisted participant origins"],
                            "event_id": "evt_fixture", "shared_provider_cache": {"touched_place_ids": ["ChIJ_fixture"],
                            "policy": "provider cache may remain"}}
                control.write_json(run / "evidence/result.json", original)
                control.write_json(run / "evidence/cleanup.json", {"status": "cleaned", "remaining_event_ids": []})
                result = control.write_failure_result(run, "places-routes", stage + " failed https://provider.example/?key=secret Ai" + "zaFixtureSecret")
                self.assertEqual(result["status"], "FAIL")
                self.assertEqual(result["scope"], original["scope"])
                self.assertEqual(result["shared_provider_cache"], original["shared_provider_cache"])
                self.assertEqual(json.loads((run / "evidence/cleanup.json").read_text())["remaining_event_ids"], [])
                raw = (run / "evidence/result.json").read_text()
                self.assertNotIn("secret", raw)
                self.assertNotIn("AIzaFixtureSecret", raw)
                self.assertIn(stage + " failed", raw)


if __name__ == "__main__":
    unittest.main()
