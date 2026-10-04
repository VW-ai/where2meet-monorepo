import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import ppe


def target():
    return {"kind": "where2meet-ppe-target-v1", "railway": {
        "project_id": ppe.PROJECT, "environment_id": ppe.ENVIRONMENT, "environment_name": "ppe",
        "backend_service_id": "11111111-1111-1111-1111-111111111111",
        "postgres_service_id": "22222222-2222-2222-2222-222222222222",
        "redis_service_id": "33333333-3333-3333-3333-333333333333",
        "deployment_id": "44444444-4444-4444-4444-444444444444", "backend_origin": "https://ppe.example.test"},
        "frontend": {"revision": "a" * 40, "origin": ppe.CLIENT_ORIGIN},
        "source": {"revision": "b" * 40, "server_tree_digest": "c" * 64, "uploaded_artifact_digest": "d" * 64}}


def provider():
    manifest = target()
    ids = manifest["railway"]
    deployment = {"id": ids["deployment_id"], "status": "SUCCESS", "deploymentStopped": False}
    instances = [{"node": {"id": "55555555-5555-5555-5555-555555555555", "serviceId": ids[field], "environmentId": ppe.ENVIRONMENT,
                           "latestDeployment": deployment, "activeDeployments": [deployment],
                           "domains": {"serviceDomains": [{"domain": "ppe.example.test"}], "customDomains": []}}}
                 for field in ("backend_service_id", "postgres_service_id", "redis_service_id")]
    status = {"id": ppe.PROJECT, "environments": {"edges": [{"node": {
        "id": ppe.ENVIRONMENT, "name": "ppe", "serviceInstances": {"edges": instances}}}]}}
    db_secret = "postgresql://user:database-secret@private.railway.internal/db"
    redis_secret = "redis://user:redis-secret@private.railway.internal"
    backend = {"RAILWAY_ENVIRONMENT_ID": ppe.ENVIRONMENT, "RAILWAY_SERVICE_ID": ids["backend_service_id"],
               "DATABASE_URL": db_secret, "REDIS_URL": redis_secret, "PPE_SOURCE_REVISION": "b" * 40, "CORS_ORIGINS": ppe.CLIENT_ORIGIN}
    postgres = {"RAILWAY_ENVIRONMENT_ID": ppe.ENVIRONMENT, "RAILWAY_SERVICE_ID": ids["postgres_service_id"], "DATABASE_URL": db_secret}
    redis = {"RAILWAY_ENVIRONMENT_ID": ppe.ENVIRONMENT, "RAILWAY_SERVICE_ID": ids["redis_service_id"], "REDIS_URL": redis_secret}
    return [manifest, status, [deployment], backend, postgres, redis]


class TargetBoundaryTest(unittest.TestCase):
    def test_explicit_identity_accepts_new_full_source_revisions(self):
        selected = target()
        selected["source"]["revision"] = "1" * 40
        selected["frontend"]["revision"] = "2" * 40
        parsed = ppe.canonical_target(selected)
        self.assertEqual(parsed["source"]["revision"], "1" * 40)
        self.assertEqual(parsed["frontend"]["revision"], "2" * 40)

    def test_staging_production_and_renamed_environment_are_rejected(self):
        for field, value in [("environment_name", "production"), ("environment_name", "staging"),
                             ("environment_id", "99999999-9999-9999-9999-999999999999")]:
            with self.subTest(field=field, value=value):
                selected = target()
                selected["railway"][field] = value
                with self.assertRaisesRegex(RuntimeError, "authorized PPE environment"):
                    ppe.canonical_target(selected)
        self.assertEqual(ppe.canonical_target(target())["railway"]["environment_name"], "ppe")

    def test_origins_reject_credentials_paths_and_queries(self):
        for origin in ("http://ppe.example.test", "https://user:secret@ppe.example.test", "https://ppe.example.test/", "https://ppe.example.test?token=secret"):
            with self.subTest(origin=origin):
                selected = target()
                selected["railway"]["backend_origin"] = origin
                with self.assertRaisesRegex(RuntimeError, "exact HTTPS origin"):
                    ppe.canonical_target(selected)

    def test_cli_rejects_secret_manifest_without_echoing_it_or_creating_a_run(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            manifest = target()
            manifest["database_url"] = "postgresql://user:do-not-print-this@host/db"
            (directory / "target.json").write_text(json.dumps(manifest))
            result = subprocess.run([sys.executable, str(Path(ppe.__file__)), "verify", "--target", str(directory / "target.json"),
                                     "--run", str(directory / "run"), "--repo", str(directory), "--frontend-repo", str(directory)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stderr)["status"], "FAIL")
            self.assertNotIn("do-not-print-this", result.stdout + result.stderr)
            self.assertFalse((directory / "run").exists())

    def test_real_provider_projection_excludes_connection_credentials(self):
        observed = ppe.verify_identity(*provider())
        self.assertEqual(observed["status"], "PASS")
        self.assertEqual(observed["deployment_id"], "44444444-4444-4444-4444-444444444444")
        self.assertEqual(observed["postgres_service_instance_id"], "55555555-5555-5555-5555-555555555555")
        self.assertNotIn("database-secret", json.dumps(observed))
        self.assertNotIn("redis-secret", json.dumps(observed))

    def test_doctor_rejects_a_run_pointing_outside_its_verified_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            manifest = target()
            state = {"kind": "where2meet-ppe-run-v1", "run_dir": str(directory), "target": manifest,
                     "target_digest": ppe.digest(manifest), "backend_url": "https://production.example.test",
                     "client_url": ppe.CLIENT_ORIGIN}
            (directory / "run.json").write_text(json.dumps(state))
            result = subprocess.run([sys.executable, str(Path(ppe.__file__)), "doctor", "--run", str(directory)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stderr), {"status": "FAIL", "error": "Run origins differ from the verified target"})

    def test_deployment_domain_and_resource_drift_fail_closed(self):
        for change in ("deployment", "overlap", "domain", "database", "environment", "source"):
            values = provider()
            instance = values[1]["environments"]["edges"][0]["node"]["serviceInstances"]["edges"][0]["node"]
            if change == "deployment":
                values[2][0]["id"] = "66666666-6666-6666-6666-666666666666"
            elif change == "overlap":
                instance["activeDeployments"].append({"id": "66666666-6666-6666-6666-666666666666"})
            elif change == "domain":
                instance["domains"]["serviceDomains"][0]["domain"] = "production.example.test"
            elif change == "database":
                values[3]["DATABASE_URL"] = "postgresql://user:production-secret@production/db"
            elif change == "environment":
                values[4]["RAILWAY_ENVIRONMENT_ID"] = "wrong-environment"
            else:
                values[3]["PPE_SOURCE_REVISION"] = "e" * 40
            with self.subTest(change=change), self.assertRaises(RuntimeError) as caught:
                ppe.verify_identity(*values)
            self.assertNotIn("production-secret", str(caught.exception))
        self.assertEqual(ppe.verify_identity(*provider())["status"], "PASS")


class MutationOwnershipTest(unittest.TestCase):
    def setUp(self):
        self.event = "evt_1760000000000_0123456789abcdef"
        self.organizer = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        self.state = {"run_id": "12345678abcdef", "backend_url": "https://ppe.example.test", "owned_events": [{
            "event_id": self.event, "organizer_id": self.organizer, "cleanup_state": "pending"}]}

    def test_create_then_owned_name_patch_matches_frontend_domain_flow(self):
        state = copy.deepcopy(self.state)
        state["owned_events"] = []
        ppe.authorize_request(state, "POST", state["backend_url"] + "/api/events", {"title": "Verification meeting 12345678"}, "ui")
        ppe.authorize_request(self.state, "PATCH", self.state["backend_url"] + f"/api/events/{self.event}/participants/{self.organizer}", {"name": "Verification organizer"}, "ui")
        with self.assertRaisesRegex(RuntimeError, "synthetic meeting"):
            ppe.authorize_request(state, "POST", state["backend_url"] + "/api/events", {"title": "Another person's meeting"}, "ui")

    def test_an_owned_delete_is_allowed_but_unrelated_ids_and_origins_are_rejected(self):
        ppe.authorize_request(self.state, "DELETE", self.state["backend_url"] + f"/api/events/{self.event}", None, "ui")
        for url in (f"https://production.example.test/api/events/{self.event}",
                    "https://ppe.example.test/api/events/evt_1760000000001_abcdef0123456789",
                    f"https://ppe.example.test/api/events/{self.event}?redirect=production"):
            with self.subTest(url=url), self.assertRaises(RuntimeError):
                ppe.authorize_request(self.state, "DELETE", url, None, "ui")

    def test_cleanup_cannot_mutate_an_already_deleted_event(self):
        deleted = copy.deepcopy(self.state)
        deleted["owned_events"][0]["cleanup_state"] = "deleted"
        url = self.state["backend_url"] + f"/api/events/{self.event}"
        with self.assertRaisesRegex(RuntimeError, "already cleaned"):
            ppe.authorize_request(deleted, "DELETE", url, None, "ui")
        ppe.authorize_request(deleted, "GET", url, None, "ui")

    def test_http_negative_checks_cannot_create_events(self):
        url = self.state["backend_url"] + "/api/events"
        for title in ("", "A valid event"):
            with self.subTest(title=title), self.assertRaisesRegex(RuntimeError, "Only the browser UI"):
                ppe.authorize_request(self.state, "POST", url, {"title": title}, "negative")


if __name__ == "__main__":
    unittest.main()
