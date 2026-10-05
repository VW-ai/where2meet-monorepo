import copy
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
import urllib.parse
import uuid

import ppe_accounts as accounts


def fixture():
    run_id = "1234567890abcdef1234567890abcdef"
    user_id = "usr_" + "1" * 32
    token = "st_" + "2" * 64
    participant_token = "pt_" + "3" * 64
    plan = {"run_id": run_id, "account": {"email": f"verify-accounts-{run_id}@example.test", "password": "Synthetic-private-password!",
            "name": "Verification account", "updatedName": "Verification renamed account", "state": "registered", "user_id": user_id,
            "identity_id": "ident_" + "4" * 32, "created_at": "2026-10-04T19:00:00", "absence_at": "2026-10-04T18:59:00+00:00"},
            "events": [{"slot": slot, "title": f"Account verification {run_id} {slot}", "state": "planned"} for slot in ("anonymous", "signed-in")],
            "sessions": {accounts.credential_hash(token): user_id}, "claims": [], "requests": {}}
    plan["events"][0].update({"state": "created", "event_id": "evt_1760000000000_0123456789abcdef",
                              "organizer_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "token": participant_token})
    state = {"run_id": run_id, "client_url": "http://127.0.0.1:4317", "backend_url": "https://ppe.example.test"}
    return plan, state, {"cookie": "session_token=" + token}


class AccountGuardTest(unittest.TestCase):
    def test_fixed_proxy_paths_bind_mutations_to_an_issued_session(self):
        plan, state, headers = fixture()
        url = state["client_url"] + "/api/users/me"
        allowed = accounts.authorize(plan, state, "PATCH", url, {"name": "Verification renamed account", "defaultFuzzyLocation": True}, headers, "ui")
        self.assertEqual(allowed["path"], "/api/users/me")
        self.assertEqual(allowed["session_hash"], accounts.credential_hash("st_" + "2" * 64))
        for cookie in (None, "st_" + "9" * 64):
            supplied = {"cookie": "session_token=" + cookie} if cookie else {}
            with self.subTest(cookie=cookie), self.assertRaises(RuntimeError):
                accounts.authorize(plan, state, "PATCH", url, {"name": "Verification renamed account"}, supplied, "ui")
        bad = copy.deepcopy(plan)
        bad["sessions"][accounts.credential_hash("st_" + "2" * 64)] = "usr_" + "9" * 32
        with self.assertRaisesRegex(RuntimeError, "another account"):
            accounts.authorize(bad, state, "PATCH", url, {"defaultFuzzyLocation": True}, headers, "ui")

    def test_claim_requires_exact_owned_event_and_participant_credential(self):
        plan, state, headers = fixture()
        event = plan["events"][0]
        body = {"eventId": event["event_id"], "participantToken": event["token"]}
        url = state["client_url"] + "/api/users/me/events/claim"
        self.assertEqual(accounts.authorize(plan, state, "POST", url, body, headers, "ui")["path"], "/api/users/me/events/claim")
        for wrong in ({**body, "eventId": "evt_1760000000001_abcdef0123456789"}, {**body, "participantToken": "pt_" + "9" * 64},
                      {**body, "role": "organizer"}):
            with self.subTest(body=wrong), self.assertRaises(RuntimeError):
                accounts.authorize(plan, state, "POST", url, wrong, headers, "ui")

    def test_registration_and_recovery_cannot_adopt_another_email(self):
        plan, state, _ = fixture()
        plan["account"]["state"] = "planned"
        expected = {key: plan["account"][key] for key in ("email", "password", "name")}
        url = state["client_url"] + "/api/auth/register"
        self.assertEqual(accounts.authorize(plan, state, "POST", url, expected, {}, "ui")["path"], "/api/auth/register")
        with self.assertRaisesRegex(RuntimeError, "synthetic plan"):
            accounts.authorize(plan, state, "POST", url, {**expected, "email": "someone@example.test"}, {}, "ui")
        plan["account"]["state"] = "registration-pending"
        body = {key: plan["account"][key] for key in ("email", "password")}
        login = state["client_url"] + "/api/auth/login"
        self.assertEqual(accounts.authorize(plan, state, "POST", login, body, {}, "cleanup")["path"], "/api/auth/login")
        with self.assertRaisesRegex(RuntimeError, "pending registration recovery"):
            accounts.authorize(plan, state, "POST", login, body, {}, "ui")

    def test_foreign_origins_redirect_queries_and_unrelated_proxy_routes_fail(self):
        plan, state, headers = fixture()
        self.assertEqual(accounts.authorize(plan, state, "GET", state["client_url"] + "/api/auth/session", None, {}, "read")["path"], "/api/auth/session")
        for url in ("https://production.example.test/api/users/me", state["client_url"] + "/api/auth/recovery/reset",
                    state["client_url"] + "/api/users/me?redirect=https://production.example.test",
                    state["client_url"] + "/api/users/%6de", state["client_url"] + "/api/events"):
            with self.subTest(url=url), self.assertRaises(RuntimeError):
                accounts.authorize(plan, state, "GET", url, None, headers, "read")

    def test_two_named_meeting_slots_allow_no_third_or_duplicate(self):
        plan, state, _ = fixture()
        signed_in = plan["events"][1]
        url = state["backend_url"] + "/api/events"
        self.assertEqual(accounts.authorize(plan, state, "POST", url, {"title": signed_in["title"]}, {}, "ui")["slot"], "signed-in")
        for title in (plan["events"][0]["title"], "Unrelated meeting"):
            with self.assertRaisesRegex(RuntimeError, "slot"):
                accounts.authorize(plan, state, "POST", url, {"title": title}, {}, "ui")
        event = plan["events"][0]
        deletion = state["backend_url"] + "/api/events/" + event["event_id"]
        self.assertEqual(accounts.authorize(plan, state, "DELETE", deletion, None, {"authorization": "Bearer " + event["token"]}, "ui")["path"], "/api/events/" + event["event_id"])
        with self.assertRaisesRegex(RuntimeError, "organizer credential"):
            accounts.authorize(plan, state, "DELETE", deletion, None, {}, "ui")

    def test_journal_is_private_and_receipt_recovery_rejects_older_accounts(self):
        plan, state, _ = fixture()
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "runtime").mkdir()
            accounts.initialize(run, state)
            loaded = accounts.load(run, state)
            self.assertEqual(loaded["account"]["email"], "verify-accounts-1234567890abcdef1234567890abcdef@example.test")
            self.assertEqual((run / "runtime/accounts.json").stat().st_mode & 0o777, 0o600)
        lookup = {"user": {"id": plan["account"]["user_id"], "created_at": "2026-10-04T19:00:00"},
                  "identities": [{"id": plan["account"]["identity_id"], "user_id": plan["account"]["user_id"], "provider": "email", "provider_matches": True}]}
        accounts.bind_account(plan, lookup, plan["account"]["user_id"])
        self.assertEqual(plan["account"]["state"], "registered")
        lookup["user"]["created_at"] = "2025-01-01T00:00:00"
        with self.assertRaisesRegex(RuntimeError, "predates"):
            accounts.bind_account(plan, lookup, plan["account"]["user_id"])

    def test_concurrent_login_receipts_preserve_both_sessions(self):
        plan, state, _ = fixture()
        plan["requests"] = {receipt: {"path": "/api/auth/login"} for receipt in ("first", "second")}
        lookup = {"user": {"id": plan["account"]["user_id"], "created_at": plan["account"]["created_at"]},
                  "identities": [{"id": plan["account"]["identity_id"], "user_id": plan["account"]["user_id"], "provider": "email", "provider_matches": True}]}
        adapter = SimpleNamespace(read_run=lambda _: {**state, "target": {}}, inspect_target=lambda _: None,
                                  run_database=lambda _run, _state, sql, **_kwargs: {"owned_active_session": True} if "owned_active_session" in sql else lookup)
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "runtime").mkdir()
            accounts.private_save(run, plan)
            payloads = [{"operation": "account-response", "receipt": receipt, "status": 200,
                         "body": {"user": {"id": plan["account"]["user_id"]}}, "session_token": "st_" + digit * 64}
                        for receipt, digit in (("first", "5"), ("second", "6"))]
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda payload: accounts.bridge(run, payload, adapter), payloads))
            self.assertEqual(results, [{"status": "recorded"}, {"status": "recorded"}])
            recorded = accounts.load(run, state)
            self.assertEqual(recorded["sessions"][accounts.credential_hash("st_" + "5" * 64)], plan["account"]["user_id"])
            self.assertEqual(recorded["sessions"][accounts.credential_hash("st_" + "6" * 64)], plan["account"]["user_id"])
            self.assertEqual(recorded["requests"], {})

    def test_event_receipt_survives_failed_postflight_for_later_cleanup(self):
        plan, state, _ = fixture()
        original = copy.deepcopy(plan["events"][0])
        plan["events"][0] = {key: original[key] for key in ("slot", "title")}
        plan["events"][0]["state"] = "create-pending"
        plan["requests"]["create"] = {"path": "/api/events", "slot": "anonymous", "mutation_identity": {"status": "PASS"}}
        def drift(_):
            raise RuntimeError("PPE deployment changed")
        adapter = SimpleNamespace(read_run=lambda _: {**state, "target": {}}, inspect_target=drift,
                                  run_database=lambda *_args, **_kwargs: self.fail("Creation receipt must not query arbitrary rows"))
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "runtime").mkdir()
            accounts.private_save(run, plan)
            with self.assertRaisesRegex(RuntimeError, "deployment changed"):
                accounts.bridge(run, {"operation": "account-response", "receipt": "create", "status": 201,
                    "body": {"id": original["event_id"], "organizerParticipantId": original["organizer_id"],
                             "participantToken": original["token"], "title": original["title"]}}, adapter)
            recorded = accounts.load(run, state)
            self.assertEqual(recorded["events"][0], original)

    def test_public_claim_response_omits_user_id_and_is_bound_by_the_database(self):
        plan, state, _ = fixture()
        owned = plan["events"][0]
        claim_id = "ue_" + "7" * 32
        response = {"success": True, "userEvent": {"id": claim_id, "eventId": owned["event_id"],
                    "participantId": owned["organizer_id"], "role": "organizer", "createdAt": "2026-10-04T19:00:00Z"}}
        request = {"path": "/api/users/me/events/claim", "body": {"eventId": owned["event_id"], "participantToken": owned["token"]}}
        plan["requests"]["claim"] = request
        database_owns_claim = True
        def database(_run, _state, sql, **_kwargs):
            self.assertIn("user_id = 'usr_11111111111111111111111111111111'", sql)
            self.assertIn("id = 'ue_77777777777777777777777777777777'", sql)
            return {"owned_claim": database_owns_claim}
        adapter = SimpleNamespace(read_run=lambda _: {**state, "target": {}}, inspect_target=lambda _: None, run_database=database)
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "runtime").mkdir()
            accounts.private_save(run, plan)
            result = accounts.bridge(run, {"operation": "account-response", "receipt": "claim", "status": 201, "body": response}, adapter)
            self.assertEqual(result, {"status": "recorded"})
            self.assertEqual(accounts.load(run, state)["claims"], [{"id": claim_id, "eventId": owned["event_id"],
                "participantId": owned["organizer_id"], "role": "organizer", "userId": plan["account"]["user_id"]}])
            database_owns_claim = False
            accounts.private_save(run, plan)
            with self.assertRaisesRegex(RuntimeError, "another account"):
                accounts.bridge(run, {"operation": "account-response", "receipt": "claim", "status": 201, "body": response}, adapter)
            self.assertEqual(accounts.load(run, state)["claims"], [])


DATABASE = os.environ.get("PPE_ACCOUNTS_TEST_DATABASE_URL")
PSQL = shutil.which("psql") or "/opt/homebrew/opt/postgresql@14/bin/psql"


@unittest.skipUnless(DATABASE, "Set PPE_ACCOUNTS_TEST_DATABASE_URL to a dedicated local accounts-helper test database")
class AccountCleanupDatabaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        selected = urllib.parse.urlsplit(DATABASE)
        if selected.hostname != "127.0.0.1" or not selected.path.startswith("/w2m_ppe_accounts_test_"):
            raise RuntimeError("Account cleanup tests require their own named loopback database")

    def sql(self, statement, success=True):
        result = subprocess.run([PSQL, DATABASE, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], input=statement, capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, "Unexpected local SQL outcome")
        return json.loads(result.stdout.strip()) if success and result.stdout.strip().startswith("{") else result.stdout.strip()

    def setUp(self):
        self.plan, _, _ = fixture()
        random = uuid.uuid4().hex
        self.plan["account"].update({"user_id": "usr_" + random, "identity_id": "ident_" + random,
                                     "email": f"verify-accounts-{random}@example.test"})
        self.plan["events"][0]["state"] = "deleted"
        self.user = self.plan["account"]["user_id"]
        self.identity = self.plan["account"]["identity_id"]
        self.email = self.plan["account"]["email"]
        self.sentinel = "usr_" + uuid.uuid4().hex
        self.event_id = "evt_1760000000000_" + uuid.uuid4().hex[:16]
        self.sql(f"""INSERT INTO "user"(id, email, name, created_at, updated_at) VALUES
 ('{self.user}', '{self.email}', 'Verification account', '2026-10-04T19:00:00', '2026-10-04T19:00:00'),
 ('{self.sentinel}', '{self.sentinel}@example.test', 'Keep unchanged', '2026-10-04T19:00:00', '2026-10-04T19:00:00');
INSERT INTO user_identity(id, user_id, provider, provider_id, password_hash) VALUES
 ('{self.identity}', '{self.user}', 'email', '{self.email}', 'synthetic hash'),
 ('ident_{self.sentinel[4:]}', '{self.sentinel}', 'email', '{self.sentinel}@example.test', 'sentinel hash');
INSERT INTO user_session(id, user_id, token_hash, expires_at) VALUES
 ('ses_{self.user[4:]}', '{self.user}', '{self.user[4:] * 2}', now() + interval '1 day'),
 ('ses_{self.sentinel[4:]}', '{self.sentinel}', '{self.sentinel[4:] * 2}', now() + interval '1 day');""")

    def tearDown(self):
        self.sql(f"DELETE FROM event WHERE id = '{self.event_id}'; DELETE FROM \"user\" WHERE id IN ('{self.user}', '{self.sentinel}');")

    def sentinel_snapshot(self):
        return self.sql(f"""SELECT json_build_object('user', (SELECT row_to_json(u) FROM "user" u WHERE id = '{self.sentinel}'),
 'identities', (SELECT json_agg(i) FROM user_identity i WHERE user_id = '{self.sentinel}'),
 'sessions', (SELECT json_agg(s) FROM user_session s WHERE user_id = '{self.sentinel}'));""")

    def owned_counts(self):
        return self.sql(f"""SELECT json_build_object('users', (SELECT count(*) FROM "user" WHERE id = '{self.user}'),
 'identities', (SELECT count(*) FROM user_identity WHERE user_id = '{self.user}'),
 'sessions', (SELECT count(*) FROM user_session WHERE user_id = '{self.user}'),
 'links', (SELECT count(*) FROM user_event WHERE user_id = '{self.user}'));""")

    def test_exact_owned_account_cleanup_preserves_sentinel_and_repeats(self):
        before = self.sentinel_snapshot()
        result = self.sql(accounts.cleanup_sql(self.plan))
        self.assertEqual(result, {"status": "cleaned", "user_id": self.user, "account_absent": True,
                                  "identities_absent": True, "sessions_absent": True, "links_absent": True})
        self.assertEqual(self.owned_counts(), {"users": 0, "identities": 0, "sessions": 0, "links": 0})
        self.assertEqual(self.sentinel_snapshot(), before)
        self.assertEqual(self.sql(accounts.cleanup_sql(self.plan)), result)
        self.assertEqual(self.sentinel_snapshot(), before)

    def test_external_event_link_aborts_without_deleting_any_account_data(self):
        self.sql(f"INSERT INTO event(id, title, updated_at) VALUES ('{self.event_id}', 'Unrelated meeting', now());\n"
                 f"INSERT INTO user_event(id, user_id, event_id, role) VALUES ('ue_{self.user[4:]}', '{self.user}', '{self.event_id}', 'participant');")
        before = self.owned_counts()
        sentinel = self.sentinel_snapshot()
        self.sql(accounts.cleanup_sql(self.plan), success=False)
        self.assertEqual(self.owned_counts(), before)
        self.assertEqual(before, {"users": 1, "identities": 1, "sessions": 1, "links": 1})
        self.assertEqual(self.sentinel_snapshot(), sentinel)
        self.sql(f"DELETE FROM event WHERE id = '{self.event_id}';")
        self.sql(accounts.cleanup_sql(self.plan))
        self.assertEqual(self.owned_counts()["users"], 0)

    def test_identity_change_and_replacement_email_are_never_deleted(self):
        self.sql(f"UPDATE user_identity SET provider = 'external' WHERE id = '{self.identity}';")
        self.sql(accounts.cleanup_sql(self.plan), success=False)
        self.assertEqual(self.owned_counts(), {"users": 1, "identities": 1, "sessions": 1, "links": 0})
        self.sql(f"UPDATE user_identity SET provider = 'email' WHERE id = '{self.identity}';")
        self.sql(accounts.cleanup_sql(self.plan))
        self.sql(f"UPDATE \"user\" SET email = '{self.email}' WHERE id = '{self.sentinel}';")
        self.sql(accounts.cleanup_sql(self.plan), success=False)
        self.assertEqual(self.sentinel_snapshot()["user"]["id"], self.sentinel)

    def test_new_cascade_dependency_requires_review_before_deletion(self):
        self.sql('CREATE TABLE helper_unexpected(id text PRIMARY KEY, user_id varchar(64) REFERENCES "user"(id) ON DELETE CASCADE);')
        try:
            self.sql(accounts.cleanup_sql(self.plan), success=False)
            self.assertEqual(self.owned_counts(), {"users": 1, "identities": 1, "sessions": 1, "links": 0})
        finally:
            self.sql('DROP TABLE helper_unexpected;')
        self.sql(accounts.cleanup_sql(self.plan))
        self.assertEqual(self.owned_counts(), {"users": 0, "identities": 0, "sessions": 0, "links": 0})

    def test_indirect_cascade_dependency_is_preserved_until_review(self):
        self.sql('CREATE TABLE helper_grandchild(identity_id varchar(64) REFERENCES user_identity(id) ON DELETE CASCADE, note text);')
        before = self.sentinel_snapshot()
        try:
            self.sql(f"INSERT INTO helper_grandchild VALUES ('{self.identity}', 'Keep this row');")
            self.sql(accounts.cleanup_sql(self.plan), success=False)
            self.assertEqual(self.owned_counts(), {"users": 1, "identities": 1, "sessions": 1, "links": 0})
            self.assertEqual(self.sql("SELECT json_build_object('note', note) FROM helper_grandchild;"), {"note": "Keep this row"})
            self.assertEqual(self.sentinel_snapshot(), before)
        finally:
            self.sql('DROP TABLE helper_grandchild;')
        self.sql(accounts.cleanup_sql(self.plan))
        self.assertEqual(self.owned_counts(), {"users": 0, "identities": 0, "sessions": 0, "links": 0})
        self.assertEqual(self.sentinel_snapshot(), before)


if __name__ == "__main__":
    unittest.main()
