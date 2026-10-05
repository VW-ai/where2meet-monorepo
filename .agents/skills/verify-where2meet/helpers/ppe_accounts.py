import fcntl
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import urllib.parse
import uuid

import control


USER_ID = re.compile(r"usr_[0-9a-f]{32}\Z")
IDENTITY_ID = re.compile(r"ident_[0-9a-f]{32}\Z")
EVENT_ID = re.compile(r"evt_[0-9]{13,15}_[A-Za-z0-9]{16}\Z")
PARTICIPANT_ID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z")
TOKEN = re.compile(r"(?:st|pt)_[0-9a-f]{64}\Z")
READS = {"/api/auth/session", "/api/users/me", "/api/users/me/events"}
WRITES = {("POST", "/api/auth/register"), ("POST", "/api/auth/login"),
          ("POST", "/api/auth/logout"), ("PATCH", "/api/users/me"),
          ("POST", "/api/users/me/events/claim")}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def private_save(run, plan):
    destination = run / "runtime" / "accounts.json"
    temporary = destination.with_suffix(".tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(plan, output)
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(destination)


def record_identity(run, receipt, phase, request, identity):
    with (run / "evidence" / "accounts-identity-checks.jsonl").open("a") as output:
        output.write(json.dumps({"receipt": receipt, "phase": phase, "method": request["method"],
                                 "path": request["path"], "identity": identity}) + "\n")


def initialize(run, state):
    run_id = state["run_id"]
    require(re.fullmatch(r"[0-9a-f]{32}", run_id), "Invalid accounts run ID")
    plan = {"run_id": run_id, "account": {
        "email": f"verify-accounts-{run_id}@example.test", "password": "Verify-" + secrets.token_hex(24) + "!",
        "name": "Verification account", "updatedName": "Verification renamed account", "state": "planned"},
        "events": [{"slot": slot, "title": f"Account verification {run_id} {slot}", "state": "planned"}
                   for slot in ("anonymous", "signed-in")], "sessions": {}, "claims": [], "requests": {}}
    private_save(run, plan)


def load(run, state):
    location = run / "runtime" / "accounts.json"
    require(location.is_file() and location.stat().st_mode & 0o077 == 0, "Accounts journal must remain private")
    plan = json.loads(location.read_text())
    require(plan["run_id"] == state["run_id"] and plan["account"]["email"] == f"verify-accounts-{state['run_id']}@example.test",
            "Accounts journal belongs to another run")
    require([entry["slot"] for entry in plan["events"]] == ["anonymous", "signed-in"], "Unexpected account meeting slots")
    return plan


def cookie_token(headers):
    cookie = headers.get("cookie", "")
    values = [item.strip().split("=", 1)[1] for item in cookie.split(";") if item.strip().startswith("session_token=")]
    require(len(values) <= 1, "Ambiguous account session cookie")
    return values[0] if values else None


def credential_hash(token):
    require(isinstance(token, str) and TOKEN.fullmatch(token), "Unexpected credential format")
    return hashlib.sha256(token.encode()).hexdigest()


def account_user(plan):
    value = plan["account"].get("user_id")
    require(isinstance(value, str) and USER_ID.fullmatch(value), "Account ownership has not been recorded")
    return value


def synthetic_names(plan):
    require(plan["account"]["name"] == "Verification account" and plan["account"]["updatedName"] == "Verification renamed account", "Synthetic profile names changed")
    return ("Verification account", "Verification renamed account")


def event(plan, event_id):
    require(isinstance(event_id, str) and EVENT_ID.fullmatch(event_id), "Invalid account meeting ID")
    entries = [entry for entry in plan["events"] if entry.get("event_id") == event_id]
    require(len(entries) == 1, "Meeting is not owned by this accounts run")
    return entries[0]


def authorize(plan, state, method, url, body, headers, purpose):
    parsed = urllib.parse.urlsplit(url)
    require(not parsed.username and not parsed.password and not parsed.query and not parsed.fragment
            and "%" not in parsed.path and ".." not in parsed.path, "API request URL is outside the accounts proof")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path
    require(purpose in ("ui", "read", "cleanup"), "Unsupported accounts request purpose")
    headers = {key.lower(): value for key, value in headers.items()}
    token = cookie_token(headers)
    token_hash = credential_hash(token) if token else None
    if token:
        require(token.startswith("st_") and token_hash in plan["sessions"], "Session was not issued to this run's account")
        require(plan["sessions"][token_hash] == account_user(plan), "Session belongs to another account")
    if origin == state["client_url"]:
        require((method == "GET" and path in READS) or (method, path) in WRITES, "Next proxy path is outside the accounts proof")
        if method == "GET":
            return {"path": path, "session_hash": token_hash}
        account = plan["account"]
        if path in ("/api/auth/register", "/api/auth/login"):
            expected = {"email": account["email"], "password": account["password"]}
            if path.endswith("register"):
                expected["name"] = account["name"]
                require(account["state"] == "planned" and purpose == "ui", "Registration is not this run's pending account")
            else:
                require(account["state"] == "registered" or (purpose == "cleanup" and account["state"] == "registration-pending"),
                        "Login requires a recorded account or pending registration recovery")
            require(body == expected, "Account credentials differ from the synthetic plan")
        else:
            require(account["state"] == "registered" and token_hash, "An owned account session is required")
            if path == "/api/users/me":
                require(isinstance(body, dict) and bool(body) and set(body) <= {"name", "defaultFuzzyLocation"}, "Profile fields are outside the synthetic plan")
                require("name" not in body or body["name"] in synthetic_names(plan), "Profile name is outside the synthetic plan")
                require("defaultFuzzyLocation" not in body or isinstance(body["defaultFuzzyLocation"], bool), "Invalid synthetic fuzzy preference")
            elif path.endswith("/claim"):
                require(isinstance(body, dict) and set(body) == {"eventId", "participantToken"}, "Invalid owned claim body")
                owned = event(plan, body["eventId"])
                require(owned["state"] == "created" and body["participantToken"] == owned["token"], "Claim credential does not own this meeting")
            else:
                require(body in (None, {}), "Logout accepts no synthetic payload")
        return {"path": path, "session_hash": token_hash}
    require(origin == state["backend_url"], "API origin differs from the selected PPE backend")
    if path == "/api/events" and method == "POST":
        require(purpose == "ui" and isinstance(body, dict) and set(body) <= {"title", "meetingTime"}, "Only planned UI meeting creation is permitted")
        entries = [entry for entry in plan["events"] if entry["title"] == body.get("title")]
        require(len(entries) == 1 and entries[0]["state"] == "planned", "Meeting slot is not available")
        require("meetingTime" not in body or isinstance(body["meetingTime"], str) and len(body["meetingTime"]) <= 40, "Invalid synthetic meeting time")
        return {"path": path, "slot": entries[0]["slot"]}
    match = re.fullmatch(r"/api/events/(evt_[A-Za-z0-9_]+)(.*)", path)
    require(bool(match), "Backend path is outside the accounts proof")
    owned = event(plan, match[1])
    suffix = match[2]
    if method in ("GET", "HEAD", "OPTIONS"):
        require(suffix in ("", "/me", "/votes", "/stream"), "Backend read is outside the accounts proof")
        return {"path": path}
    require(owned["state"] == "created", "Meeting is not pending cleanup")
    require(headers.get("authorization") == "Bearer " + owned["token"], "Meeting mutation lacks its UI-issued organizer credential")
    if method == "DELETE" and not suffix:
        require(body in (None, {}), "Meeting deletion accepts no body")
    else:
        expected_name = "Verification organizer" if owned["slot"] == "anonymous" else "Verification signed-in organizer"
        require(method == "PATCH" and suffix == "/participants/" + owned["organizer_id"] and body == {"name": expected_name},
                "Meeting mutation is outside the accounts proof")
    return {"path": path}


def account_lookup_sql(plan):
    email = plan["account"]["email"]
    require(re.fullmatch(r"verify-accounts-[0-9a-f]{32}@example\.test", email), "Invalid synthetic email")
    return f"""BEGIN READ ONLY;
SELECT json_build_object('clock', clock_timestamp(), 'user',
 (SELECT row_to_json(u) FROM (SELECT id, created_at FROM "user" WHERE email = '{email}') u),
 'identities', (SELECT coalesce(json_agg(i), '[]'::json) FROM
 (SELECT i.id, i.user_id, i.provider, i.provider_id = '{email}' AS provider_matches
 FROM user_identity i JOIN "user" u ON u.id = i.user_id WHERE u.email = '{email}') i),
 'email_identity_exists', EXISTS(SELECT 1 FROM user_identity WHERE provider = 'email' AND provider_id = '{email}'));
COMMIT;"""


def session_sql(user_id, token_hash):
    require(USER_ID.fullmatch(user_id) and re.fullmatch(r"[0-9a-f]{64}", token_hash), "Invalid owned session lookup")
    return f"""BEGIN READ ONLY;
SELECT json_build_object('owned_active_session', EXISTS(SELECT 1 FROM user_session
 WHERE user_id = '{user_id}' AND token_hash = '{token_hash}' AND expires_at > now()));
COMMIT;"""


def snapshot_sql(plan, event_id, user_id, expected_name):
    event(plan, event_id)
    require(user_id is None or user_id == account_user(plan), "Snapshot user differs from the owned account")
    require(expected_name in synthetic_names(plan), "Snapshot name is outside the plan")
    user_where = f"id = '{user_id}'" if user_id else "false"
    dependent_where = f"user_id = '{user_id}'" if user_id else "false"
    return f"""BEGIN READ ONLY;
SELECT json_build_object(
 'event_exists', EXISTS(SELECT 1 FROM event WHERE id = '{event_id}'),
 'participants', (SELECT coalesce(json_agg(p), '[]'::json) FROM
 (SELECT id, is_organizer, token_hash IS NOT NULL AS has_credential,
 lat IS NULL AND lng IS NULL AS has_no_location FROM participant WHERE event_id = '{event_id}') p),
 'user', (SELECT row_to_json(u) FROM (SELECT id, name = '{expected_name}' AS name_matches,
 default_fuzzy_location, default_address IS NULL AS has_no_default_address FROM "user" WHERE {user_where}) u),
 'links', (SELECT coalesce(json_agg(l), '[]'::json) FROM
 (SELECT event_id, user_id, participant_id, role FROM user_event WHERE {dependent_where} AND event_id = '{event_id}') l),
 'identities', (SELECT coalesce(json_agg(i), '[]'::json) FROM
 (SELECT id, user_id, provider, password_hash IS NOT NULL AND length(password_hash) > 0 AS has_password_hash
 FROM user_identity WHERE {dependent_where}) i),
 'sessions', (SELECT coalesce(json_agg(s), '[]'::json) FROM
 (SELECT id, user_id, expires_at, expires_at > now() AS is_active,
 token_hash IS NOT NULL AND length(token_hash) > 0 AS has_token_hash
 FROM user_session WHERE {dependent_where} ORDER BY created_at) s),
 'has_active_session', EXISTS(SELECT 1 FROM user_session WHERE {dependent_where} AND expires_at > now()));
COMMIT;"""


def event_absence_sql(event_id):
    require(EVENT_ID.fullmatch(event_id), "Invalid owned event cleanup ID")
    return f"""BEGIN READ ONLY;
SELECT json_build_object('absent', NOT EXISTS(SELECT 1 FROM event WHERE id = '{event_id}')
 AND NOT EXISTS(SELECT 1 FROM participant WHERE event_id = '{event_id}')
 AND NOT EXISTS(SELECT 1 FROM vote WHERE event_id = '{event_id}')
 AND NOT EXISTS(SELECT 1 FROM user_event WHERE event_id = '{event_id}'));
COMMIT;"""


def claim_sql(plan, entry, claim_id):
    user_id = account_user(plan)
    event_id = entry["event_id"]
    participant_id = entry["organizer_id"]
    require(re.fullmatch(r"ue_[0-9a-f]{32}", claim_id) and EVENT_ID.fullmatch(event_id)
            and PARTICIPANT_ID.fullmatch(participant_id), "Invalid owned claim identifiers")
    return f"""BEGIN READ ONLY;
SELECT json_build_object('owned_claim', EXISTS(SELECT 1 FROM user_event WHERE id = '{claim_id}'
 AND user_id = '{user_id}' AND event_id = '{event_id}' AND participant_id = '{participant_id}' AND role = 'organizer'));
COMMIT;"""


def cleanup_sql(plan):
    account = plan["account"]
    user_id = account_user(plan)
    identity = account.get("identity_id", "")
    require(IDENTITY_ID.fullmatch(identity), "Account identity ownership is missing")
    email = account["email"]
    require(re.fullmatch(r"verify-accounts-[0-9a-f]{32}@example\.test", email), "Invalid account cleanup email")
    require(all(entry["state"] in ("planned", "deleted") for entry in plan["events"]), "Owned meetings remain before account cleanup")
    created = account.get("created_at", "")
    require(re.fullmatch(r"[0-9T:.+ -]+", created), "Account creation receipt is missing")
    event_ids = [entry["event_id"] for entry in plan["events"] if entry.get("event_id")]
    require(all(EVENT_ID.fullmatch(value) for value in event_ids), "Invalid owned meeting cleanup IDs")
    event_condition = " OR ".join(f"id = '{value}'" for value in event_ids) or "false"
    return f"""BEGIN;
SET LOCAL statement_timeout = '10s';
DO $cleanup$
DECLARE owned "user"%ROWTYPE;
BEGIN
 SELECT * INTO owned FROM "user" WHERE id = '{user_id}' FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM "user" WHERE email = '{email}') OR
     EXISTS(SELECT 1 FROM user_identity WHERE user_id = '{user_id}' OR (provider = 'email' AND provider_id = '{email}')) OR
     EXISTS(SELECT 1 FROM user_session WHERE user_id = '{user_id}') OR
     EXISTS(SELECT 1 FROM user_event WHERE user_id = '{user_id}') THEN
   RAISE EXCEPTION 'Owned account absence could not be proved';
  END IF;
  RETURN;
 END IF;
 IF owned.email <> '{email}' OR owned.created_at <> '{created}'::timestamp THEN
  RAISE EXCEPTION 'Account ownership receipt changed';
 END IF;
 PERFORM 1 FROM user_identity WHERE user_id = '{user_id}' FOR UPDATE;
 IF (SELECT count(*) FROM user_identity WHERE user_id = '{user_id}') <> 1 OR
    NOT EXISTS(SELECT 1 FROM user_identity WHERE id = '{identity}' AND user_id = '{user_id}'
      AND provider = 'email' AND provider_id = '{email}') THEN
  RAISE EXCEPTION 'Account identity ownership changed';
 END IF;
 IF EXISTS(SELECT 1 FROM event WHERE {event_condition}) OR
    EXISTS(SELECT 1 FROM user_event WHERE user_id = '{user_id}') THEN
  RAISE EXCEPTION 'Account still has meeting data';
 END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f'
      AND confrelid IN ('"user"'::regclass, 'user_identity'::regclass, 'user_session'::regclass, 'user_event'::regclass)) <> 3 OR
    (SELECT count(DISTINCT conrelid) FROM pg_constraint WHERE contype = 'f' AND confrelid = '"user"'::regclass) <> 3 OR
    EXISTS(SELECT 1 FROM pg_constraint WHERE contype = 'f'
      AND confrelid IN ('"user"'::regclass, 'user_identity'::regclass, 'user_session'::regclass, 'user_event'::regclass)
      AND (confrelid <> '"user"'::regclass OR confdeltype <> 'c'
        OR conrelid NOT IN ('user_identity'::regclass, 'user_session'::regclass, 'user_event'::regclass)
        OR conkey <> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = conrelid AND attname = 'user_id')]
        OR confkey <> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = confrelid AND attname = 'id')])) OR
    EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
      AND tgrelid IN ('"user"'::regclass, 'user_identity'::regclass, 'user_session'::regclass, 'user_event'::regclass)) THEN
  RAISE EXCEPTION 'Account cleanup dependencies changed';
 END IF;
 DELETE FROM "user" WHERE id = '{user_id}' AND email = '{email}';
 IF NOT FOUND THEN RAISE EXCEPTION 'Owned account was not deleted'; END IF;
 IF EXISTS(SELECT 1 FROM "user" WHERE id = '{user_id}' OR email = '{email}') OR
    EXISTS(SELECT 1 FROM user_identity WHERE user_id = '{user_id}') OR
    EXISTS(SELECT 1 FROM user_session WHERE user_id = '{user_id}') OR
    EXISTS(SELECT 1 FROM user_event WHERE user_id = '{user_id}') THEN
  RAISE EXCEPTION 'Account dependents remain';
 END IF;
END
$cleanup$;
SELECT json_build_object('status', 'cleaned', 'user_id', '{user_id}', 'account_absent', true,
 'identities_absent', true, 'sessions_absent', true, 'links_absent', true);
COMMIT;"""


def bind_account(plan, lookup, user_id):
    account = plan["account"]
    require(USER_ID.fullmatch(user_id) and lookup["user"] and lookup["user"]["id"] == user_id, "Registration user differs from synthetic database row")
    identities = lookup["identities"]
    require(len(identities) == 1 and identities[0]["user_id"] == user_id and identities[0]["provider"] == "email"
            and identities[0]["provider_matches"] and IDENTITY_ID.fullmatch(identities[0]["id"]), "Synthetic account identity differs")
    created = datetime.fromisoformat(lookup["user"]["created_at"])
    absence = datetime.fromisoformat(account["absence_at"])
    require(created.replace(tzinfo=created.tzinfo or timezone.utc) >= absence.replace(tzinfo=absence.tzinfo or timezone.utc),
            "Synthetic account predates the registration intent")
    if account.get("user_id"):
        require(account["user_id"] == user_id, "Account ID changed after registration")
    account.update({"state": "registered", "user_id": user_id, "identity_id": identities[0]["id"], "created_at": lookup["user"]["created_at"]})


def bridge(run, payload, ppe):
    with (run / "runtime" / "accounts.lock").open("a") as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = ppe.read_run(run)
        plan = load(run, state)
        operation = payload.get("operation")
        database = lambda sql, readonly=True, identity=None: ppe.run_database(run, state, sql, readonly=readonly, mutation_identity=identity)
        if operation == "account-plan":
            return {"account": {key: plan["account"][key] for key in ("email", "password", "name", "updatedName")},
                    "titles": {entry["slot"]: entry["title"] for entry in plan["events"]}}
        if operation == "account-guard":
            ppe.assert_frontend(state)
            request = {key: payload.get(key) for key in ("method", "url", "body")}
            request.update({"headers": payload.get("headers", {}), "purpose": payload.get("purpose", "ui")})
            policy = authorize(plan, state, **request)
            identity = None
            if request["method"] not in ("GET", "HEAD", "OPTIONS"):
                identity, _ = ppe.inspect_target(state["target"])
            if policy.get("session_hash") and request["method"] not in ("GET", "HEAD", "OPTIONS"):
                require(database(session_sql(account_user(plan), policy["session_hash"]), identity=identity)["owned_active_session"], "Account session is no longer active")
            if policy["path"] == "/api/auth/register":
                absent = database(account_lookup_sql(plan), identity=identity)
                require(absent["user"] is None and not absent["email_identity_exists"], "Synthetic registration identity already exists")
                plan["account"].update({"state": "registration-pending", "absence_at": absent["clock"]})
            if policy.get("slot"):
                next(entry for entry in plan["events"] if entry["slot"] == policy["slot"])["state"] = "create-pending"
            receipt = uuid.uuid4().hex
            plan["requests"][receipt] = {**request, **policy, "mutation_identity": identity}
            private_save(run, plan)
            if identity:
                record_identity(run, receipt, "before", plan["requests"][receipt], identity)
            return {"receipt": receipt}
        if operation == "account-response":
            request = plan["requests"].get(payload.get("receipt"))
            require(request is not None, "Account response has no guarded request")
            status = payload.get("status")
            require(isinstance(status, int) and not 300 <= status < 400, "Account API redirect is not accepted")
            response = payload.get("body")
            if 200 <= status < 300:
                path = request["path"]
                if path in ("/api/auth/register", "/api/auth/login"):
                    require(isinstance(response, dict) and isinstance(response.get("user"), dict), "Account response is missing its user")
                    user_id = response["user"].get("id", "")
                    bind_account(plan, database(account_lookup_sql(plan), identity=request.get("mutation_identity")), user_id)
                    token = payload.get("session_token", "")
                    require(isinstance(token, str) and token.startswith("st_"), "Account response is missing its session")
                    token_hash = credential_hash(token)
                    require(database(session_sql(user_id, token_hash), identity=request.get("mutation_identity"))["owned_active_session"], "Issued session does not belong to the synthetic account")
                    plan["sessions"][token_hash] = user_id
                elif request.get("slot"):
                    entry = next(item for item in plan["events"] if item["slot"] == request["slot"])
                    require(isinstance(response, dict) and EVENT_ID.fullmatch(response.get("id", "")) and PARTICIPANT_ID.fullmatch(response.get("organizerParticipantId", ""))
                            and response.get("title") == entry["title"], "Created account meeting differs from its slot")
                    token = response.get("participantToken", "")
                    require(isinstance(token, str) and token.startswith("pt_") and TOKEN.fullmatch(token), "Created account meeting has no organizer credential")
                    entry.update({"state": "created", "event_id": response["id"], "organizer_id": response["organizerParticipantId"], "token": token})
                elif path == "/api/users/me/events/claim":
                    link = response.get("userEvent", {}) if isinstance(response, dict) else {}
                    entry = event(plan, request["body"]["eventId"])
                    expected = {"eventId": entry["event_id"], "participantId": entry["organizer_id"], "role": "organizer"}
                    require(all(link.get(key) == value for key, value in expected.items()), "Claim response differs from the owned relationship")
                    require(database(claim_sql(plan, entry, link.get("id", "")), identity=request.get("mutation_identity"))["owned_claim"], "Claim row belongs to another account")
                    owned_claim = {**expected, "userId": account_user(plan), "id": link["id"]}
                    if owned_claim not in plan["claims"]:
                        plan["claims"].append(owned_claim)
                elif path in ("/api/auth/session", "/api/users/me"):
                    user = response.get("user", {}) if path.endswith("/session") else response
                    require(isinstance(user, dict) and user.get("id") == account_user(plan), "Profile response belongs to another account")
            del plan["requests"][payload["receipt"]]
            private_save(run, plan)
            if request.get("mutation_identity"):
                observed, _ = ppe.inspect_target(state["target"])
                record_identity(run, payload["receipt"], "after", request, observed)
            return {"status": "recorded"}
        if operation == "account-stream-open":
            request = plan["requests"].get(payload.get("receipt"))
            require(request and request["method"] == "GET" and request["path"].endswith("/stream"), "Only an owned event stream can be continued")
            del plan["requests"][payload["receipt"]]
            private_save(run, plan)
            return {"status": "allowed", "response_observed": False}
        if operation == "stored-account":
            return database(snapshot_sql(plan, payload["event_id"], payload.get("user_id"), payload["expected_name"]))
        if operation == "account-cleanup-plan":
            if plan["account"]["state"] == "registration-pending":
                found = database(account_lookup_sql(plan))
                if found["user"] is None and not found["email_identity_exists"]:
                    plan["account"]["state"] = "planned"
                    private_save(run, plan)
            require(not any(entry["state"] == "create-pending" for entry in plan["events"]),
                    "Meeting creation response was lost; pending synthetic title retained for recovery")
            return {"account_state": plan["account"]["state"], "events": plan["events"]}
        if operation == "account-event-closed":
            entry = event(plan, payload["event_id"])
            require(database(event_absence_sql(entry["event_id"]))["absent"], "Owned account meeting remains in the database")
            entry["state"] = "deleted"
            private_save(run, plan)
            return {"deleted": entry["event_id"]}
        if operation == "cleanup-account":
            require(all(entry["state"] in ("planned", "deleted") for entry in plan["events"]), "Owned meetings remain before account cleanup")
            if plan["account"]["state"] == "planned":
                observed = database(account_lookup_sql(plan))
                require(observed["user"] is None and not observed["email_identity_exists"], "Unrecorded synthetic account remains")
                result = {"status": "cleaned", "account_created": False}
            else:
                require(plan["account"]["state"] in ("registered", "deleted"), "Registration recovery is required before account cleanup")
                result = database(cleanup_sql(plan), readonly=False)
                plan["account"]["state"] = "deleted"
                private_save(run, plan)
            control.write_json(run / "evidence" / "account-cleanup.json", result)
            return result
        raise RuntimeError("Unknown accounts bridge operation")


def cleanup(run, ppe):
    state = ppe.read_run(run)
    if state["status"] == "cleaned" and not (run / "runtime").exists():
        return json.loads((run / "evidence" / "cleanup.json").read_text())
    issues = ppe.stop_local(run, {"browser"})
    try:
        plan = load(run, state)
        if any(entry["state"] not in ("planned", "deleted") for entry in plan["events"]) or plan["account"]["state"] == "registration-pending":
            record = state["processes"].get("frontend", {})
            if not control.process_identity(record.get("pid", 0)):
                with socket.socket() as listener:
                    listener.bind(("127.0.0.1", 4317))
                ppe.launch_frontend(run, state, ppe.private_environment())
            ppe.doctor(run)
            result = subprocess.run(["node", str(ppe.HELPERS / "ppe-accounts-browser.mjs"), str(run), "--cleanup"],
                                    env=ppe.private_environment(), capture_output=True, text=True, timeout=360)
            require(result.returncode == 0, "Owned accounts UI cleanup failed")
        bridge(run, {"operation": "cleanup-account"}, ppe)
    except Exception as error:
        issues.append(str(error) if isinstance(error, RuntimeError) else "Owned account cleanup failed")
    issues.extend(ppe.stop_local(run))
    state = ppe.read_run(run)
    plan = load(run, state)
    pending = [{"slot": item["slot"], "state": item["state"], "event_id": item.get("event_id")} for item in plan["events"]
               if item["state"] not in ("planned", "deleted")]
    state["status"] = "cleanup-incomplete" if issues else "cleaned"
    state["cleanup_issues"] = issues
    control.save(run, state)
    report = {"status": state["status"], "issues": issues, "remaining_events": pending,
              "account_state": plan["account"]["state"], "account_id": plan["account"].get("user_id"),
              "remote_resources_deleted": False, "account_cleanup": "fixed owned-account SQL transaction",
              "cleanup_verifier_fingerprint": ppe.verifier_fingerprint(), "verification_verifier_fingerprint": state["verifier_fingerprint"]}
    control.write_json(run / "evidence" / "cleanup.json", report)
    if not issues:
        shutil.rmtree(run / "runtime")
    require(not issues, "PPE accounts cleanup incomplete; private ownership journal retained")
    return report
