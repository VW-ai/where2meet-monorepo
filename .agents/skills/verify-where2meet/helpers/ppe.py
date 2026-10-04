#!/usr/bin/env python3
"""Verify one explicitly identified Railway PPE deployment through a pinned local frontend."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

import control


PROJECT = "848dc1e0-d9c2-4571-b542-73a1efdc5848"
ENVIRONMENT = "b4f01e02-40e8-406d-94a7-3797b3db4eea"
CLIENT_ORIGIN = "http://127.0.0.1:4317"
HELPERS = Path(__file__).resolve().parent
EVENT_ID = re.compile(r"evt_[0-9]{13,15}_[A-Za-z0-9]{16}\Z")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def verifier_fingerprint():
    return hashlib.sha256(b"".join((HELPERS / name).read_bytes() for name in ("control.py", "ppe.py", "browser.mjs", "ppe-browser.mjs"))).hexdigest()


def private_environment():
    env = control.clean_environment()
    for name in ("RAILWAY_TOKEN", "RAILWAY_API_TOKEN", "PPE_SSH_KEY", "PPE_SSH_KNOWN_HOSTS"):
        if os.environ.get(name):
            env[name] = os.environ[name]
    return env


def canonical_target(raw):
    require(isinstance(raw, dict) and raw.get("kind") == "where2meet-ppe-target-v1", "Expected a PPE target manifest")
    railway = raw.get("railway", {})
    frontend = raw.get("frontend", {})
    source = raw.get("source", {})
    require(railway.get("project_id") == PROJECT, "Project is outside the authorized PPE project")
    require(railway.get("environment_id") == ENVIRONMENT and railway.get("environment_name") == "ppe", "Environment is not the authorized PPE environment")
    for field in ("backend_service_id", "postgres_service_id", "redis_service_id", "deployment_id"):
        require(isinstance(railway.get(field), str) and re.fullmatch(r"[0-9a-f-]{36}", railway[field]), f"Missing or invalid {field}")
    require(len({railway[key] for key in ("backend_service_id", "postgres_service_id", "redis_service_id")}) == 3, "PPE services must be distinct")
    origin = urllib.parse.urlsplit(railway.get("backend_origin", ""))
    require(origin.scheme == "https" and bool(origin.hostname) and not origin.username and not origin.password
            and origin.path == "" and not origin.query and not origin.fragment
            and origin.geturl() == railway["backend_origin"], "Backend must be an exact HTTPS origin without credentials")
    require(isinstance(frontend.get("revision"), str) and re.fullmatch(r"[0-9a-f]{40}", frontend["revision"])
            and frontend.get("origin") == CLIENT_ORIGIN, "Frontend requires a full pinned revision and fixed loopback origin")
    require(isinstance(source.get("revision"), str) and re.fullmatch(r"[0-9a-f]{40}", source["revision"]), "Backend requires a full pinned revision")
    for field in ("server_tree_digest", "uploaded_artifact_digest"):
        require(isinstance(source.get(field), str) and re.fullmatch(r"[0-9a-f]{64}", source[field]), f"Missing {field}")
    result = {"kind": raw["kind"], "railway": {key: railway[key] for key in (
        "project_id", "environment_id", "environment_name", "backend_service_id", "postgres_service_id",
        "redis_service_id", "deployment_id", "backend_origin")},
        "frontend": {"revision": frontend["revision"], "origin": CLIENT_ORIGIN},
        "source": {key: source[key] for key in ("revision", "server_tree_digest", "uploaded_artifact_digest")}}
    if frontend.get("client_tree_digest"):
        require(re.fullmatch(r"[0-9a-f]{64}", frontend["client_tree_digest"]), "Invalid frontend digest")
        result["frontend"]["client_tree_digest"] = frontend["client_tree_digest"]
    require(raw == result, "Target contains unknown fields; secrets and arbitrary policy overrides are not accepted")
    return result


def read_run(run):
    state = json.loads((run / "run.json").read_text())
    require(state.get("kind") == "where2meet-ppe-run-v1" and state.get("run_dir") == str(run), "Not an owned PPE run")
    target = canonical_target(state["target"])
    require(digest(target) == state["target_digest"], "Target changed after run creation")
    require(state.get("backend_url") == target["railway"]["backend_origin"]
            and state.get("client_url") == target["frontend"]["origin"], "Run origins differ from the verified target")
    require(state.get("frontend_commit") == target["frontend"]["revision"]
            and state.get("source_commit") == target["source"]["revision"]
            and state.get("source_fingerprint") == target["source"]["server_tree_digest"], "Run revisions differ from the verified target")
    require(state.get("source_copy") == str(run / "runtime" / "app") and state.get("ports") == {"frontend": 4317}, "Run frontend ownership differs from its private runtime")
    return state


def railway_json(target, operation, service=None):
    identity = target["railway"]
    args = ["railway", *operation, "--project", identity["project_id"], "--environment", identity["environment_id"], "--json"]
    if service:
        args.extend(["--service", service])
    env = private_environment()
    result = subprocess.run(args, capture_output=True, text=True, env=env, timeout=45)
    require(result.returncode == 0, "Railway read failed; raw provider output withheld")
    try:
        return json.loads(result.stdout)
    except ValueError:
        raise RuntimeError("Railway returned invalid JSON; raw output withheld") from None


def nodes(connection):
    return [edge["node"] for edge in connection.get("edges", [])]


def verify_identity(target, status, deployments, backend, postgres, redis):
    expected = target["railway"]
    require(status.get("id") == PROJECT, "Observed project differs from PPE")
    environments = [item for item in nodes(status.get("environments", {})) if item.get("id") == ENVIRONMENT]
    require(len(environments) == 1 and environments[0].get("name") == "ppe" and not environments[0].get("deletedAt"), "Observed PPE environment is missing or renamed")
    instances = {item["serviceId"]: item for item in nodes(environments[0].get("serviceInstances", {}))}
    for field in ("backend_service_id", "postgres_service_id", "redis_service_id"):
        require(expected[field] in instances, f"PPE environment does not contain {field}")
        require(instances[expected[field]].get("environmentId", ENVIRONMENT) == ENVIRONMENT, "Service belongs to a different environment")
    instance = instances[expected["backend_service_id"]]
    latest = instance.get("latestDeployment") or {}
    require(latest.get("id") == expected["deployment_id"] and latest.get("status") == "SUCCESS", "PPE active deployment changed or is not successful")
    active = instance.get("activeDeployments", [])
    require(len(active) == 1 and active[0].get("id") == expected["deployment_id"] and not active[0].get("deploymentStopped"), "PPE has unexpected active deployments")
    require(isinstance(deployments, list) and bool(deployments), "Deployment list is empty")
    require(deployments[0].get("id") == expected["deployment_id"] and deployments[0].get("status") == "SUCCESS", "PPE latest deployment changed or is not successful")
    metadata = deployments[0].get("meta") or {}
    if metadata.get("commitHash"):
        require(metadata["commitHash"] == target["source"]["revision"], "Deployment commit differs from selected source")
    domains = instance.get("domains", {})
    origins = {"https://" + item["domain"] for kind in ("serviceDomains", "customDomains") for item in domains.get(kind, [])}
    require(expected["backend_origin"] in origins, "Backend origin is not assigned to the PPE service")
    for variables, service in ((backend, expected["backend_service_id"]), (postgres, expected["postgres_service_id"]), (redis, expected["redis_service_id"])):
        require(variables.get("RAILWAY_ENVIRONMENT_ID") == ENVIRONMENT and variables.get("RAILWAY_SERVICE_ID") == service,
                "Resolved variables belong to an unexpected resource")
    require(backend.get("PPE_SOURCE_REVISION") == target["source"]["revision"], "Deployment setup source attestation differs")
    require(bool(postgres.get("DATABASE_URL")) and backend.get("DATABASE_URL") == postgres["DATABASE_URL"], "Backend database reference is not the verified PPE PostgreSQL service")
    require(bool(redis.get("REDIS_URL")) and backend.get("REDIS_URL") == redis["REDIS_URL"], "Backend Redis reference is not the verified PPE Redis service")
    require(CLIENT_ORIGIN in backend.get("CORS_ORIGINS", "").split(",") and "*" not in backend.get("CORS_ORIGINS", ""), "PPE does not allow the exact local frontend origin")
    postgres_instance = instances[expected["postgres_service_id"]].get("id", "")
    require(re.fullmatch(r"[0-9a-f-]{36}", postgres_instance), "PPE PostgreSQL service instance is missing")
    return {"status": "PASS", "at": now(), **expected, "source_revision": target["source"]["revision"],
            "postgres_service_instance_id": postgres_instance,
            "source_provenance": "setup-attested upload; not independent runtime source identity",
            "deployment_check": "fresh pre/post checks; HTTP mutation cannot be atomically pinned"}


def inspect_target(target):
    ids = target["railway"]
    calls = [(target, ["status"]), (target, ["deployment", "list", "--limit", "1"], ids["backend_service_id"])]
    calls += [(target, ["variables"], ids[field]) for field in ("backend_service_id", "postgres_service_id", "redis_service_id")]
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(railway_json, *args) for args in calls]
        status, deployments, backend, postgres, redis = [future.result() for future in futures]
    evidence = verify_identity(target, status, deployments, backend, postgres, redis)
    return evidence, postgres


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http(url, method="GET", headers=None):
    request = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        result = urllib.request.build_opener(NoRedirect()).open(request, timeout=15)
    except urllib.error.HTTPError as error:
        result = error
    except OSError:
        raise RuntimeError("HTTP readiness request failed; network details withheld") from None
    with result:
        return result.status, dict(result.headers), result.read()


def assert_frontend(state):
    require(control.fingerprint(Path(state["source_copy"]), ("client",)) == state["frontend_fingerprint"], "Pinned frontend source changed")
    control.require_owned_listener(state, "frontend")


def doctor(run, frontend=True):
    state = read_run(run)
    evidence, _ = inspect_target(state["target"])
    if frontend:
        assert_frontend(state)
    status, _, body = http(state["backend_url"] + "/health/ready")
    ready = json.loads(body)
    require(status == 200 and ready.get("status") == "ok" and ready.get("services") == {"database": "ok", "redis": "ok"}, "PPE database and Redis are not ready")
    status, headers, _ = http(state["backend_url"] + "/api/events", "OPTIONS", {
        "Origin": CLIENT_ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization"})
    headers = {key.lower(): value for key, value in headers.items()}
    require(status in (200, 204) and headers.get("access-control-allow-origin") == CLIENT_ORIGIN
            and headers.get("access-control-allow-credentials") == "true", "PPE CORS does not authorize the exact frontend origin")
    if frontend:
        require(http(CLIENT_ORIGIN)[0] == 200, "Pinned frontend did not respond")
        require(http(CLIENT_ORIGIN + "/api/auth/session")[0] == 401, "Anonymous Next session proxy did not return 401")
    evidence.update({"frontend_revision": state["frontend_commit"], "frontend_fingerprint": state["frontend_fingerprint"], "mocks": "off"})
    control.write_json(run / "evidence" / "doctor.json", evidence)
    return evidence


def owned_event(state, event_id):
    require(isinstance(event_id, str) and EVENT_ID.fullmatch(event_id), "Invalid event ID")
    entries = [item for item in state["owned_events"] if item["event_id"] == event_id]
    require(len(entries) == 1, "Event is not owned by this UI run")
    return entries[0]


def authorize_request(state, method, url, body, purpose):
    parsed = urllib.parse.urlsplit(url)
    require(f"{parsed.scheme}://{parsed.netloc}" == state["backend_url"] and not parsed.query and not parsed.fragment, "API request origin or URL is outside PPE")
    path = parsed.path
    if method in ("GET", "HEAD", "OPTIONS"):
        return
    if path == "/api/events" and method == "POST":
        require(isinstance(body, dict), "Event creation requires a JSON body")
        require(purpose == "ui", "Only the browser UI may create a synthetic meeting")
        require(body.get("title") == f"Verification meeting {state['run_id'][:8]}" and not state["owned_events"], "Create request is not this run's synthetic meeting")
        return
    match = re.fullmatch(r"/api/events/(evt_[A-Za-z0-9_]+)(.*)", path)
    require(bool(match), "Mutation path is outside the selected M1 proof")
    entry = owned_event(state, match[1])
    suffix = match[2]
    require(entry["cleanup_state"] == "pending", "Event was already cleaned")
    if not suffix and method in ("PATCH", "DELETE"):
        return
    require(suffix == "/participants/" + entry["organizer_id"] and method == "PATCH", "Mutation does not address the UI-created organizer")


def observe_event(run, state, event_id):
    owned_event(state, event_id)
    before, _ = inspect_target(state["target"])
    key = Path(os.environ.get("PPE_SSH_KEY", ""))
    require(key.is_file() and key.stat().st_mode & 0o077 == 0, "PPE_SSH_KEY must name a private mode-0600 SSH identity file")
    known_hosts = Path(os.environ.get("PPE_SSH_KNOWN_HOSTS", ""))
    require(known_hosts.is_file(), "PPE_SSH_KNOWN_HOSTS must name the independently verified Railway host keys")
    sql = f"""BEGIN READ ONLY;
SELECT json_build_object(
 'event', (SELECT row_to_json(e) FROM (SELECT id, title, meeting_time, published_at FROM event WHERE id = '{event_id}') e),
 'participants', (SELECT coalesce(json_agg(p), '[]'::json) FROM
 (SELECT id, event_id, name, is_organizer, token_hash IS NOT NULL AS has_credential
 FROM participant WHERE event_id = '{event_id}' ORDER BY id) p));
COMMIT;
"""
    remote_command = 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=10000" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -A -t -v ON_ERROR_STOP=1'
    result = subprocess.run(["ssh", "-T", "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
                             "-o", "ConnectTimeout=15", "-o", "UserKnownHostsFile=" + str(known_hosts), "-i", str(key),
                             before["postgres_service_instance_id"] + "@ssh.railway.com", remote_command],
                            input=sql, capture_output=True, text=True, env=private_environment(), timeout=45)
    require(result.returncode == 0, "Read-only PPE database corroboration failed; connection details withheld")
    try:
        projection = json.loads(result.stdout.strip())
    except ValueError:
        raise RuntimeError("PPE database projection was invalid; raw output withheld") from None
    after, _ = inspect_target(state["target"])
    control.write_json(run / "evidence" / "database-identity.json", {"before": before, "after": after, "transaction": "read-only", "role_write_privileges": "not asserted"})
    return projection


def bridge(run, payload):
    state = read_run(run)
    operation = payload.get("operation")
    if operation == "guard":
        assert_frontend(state)
        authorize_request(state, payload["method"], payload["url"], payload.get("body"), payload.get("purpose", "ui"))
        observed, _ = inspect_target(state["target"])
        with (run / "evidence" / "identity-checks.jsonl").open("a") as output:
            output.write(json.dumps(observed) + "\n")
        return observed
    if operation == "postflight":
        observed, _ = inspect_target(state["target"])
        return observed
    if operation == "record":
        require(not state["owned_events"], "This run already owns its synthetic meeting")
        require(EVENT_ID.fullmatch(payload.get("event_id", "")), "Invalid created event ID")
        require(re.fullmatch(r"[0-9a-f-]{36}", payload.get("organizer_id", "")), "Invalid created organizer ID")
        require(payload.get("title") == f"Verification meeting {state['run_id'][:8]}", "Created title differs from the synthetic title")
        state["owned_events"].append({"event_id": payload["event_id"], "organizer_id": payload["organizer_id"],
            "initial_title": payload["title"], "created_at": now(), "creation_deployment_id": state["target"]["railway"]["deployment_id"], "cleanup_state": "pending"})
        control.save(run, state)
        return {"recorded": payload["event_id"]}
    if operation == "stored":
        return observe_event(run, state, payload["event_id"])
    if operation == "closed":
        entry = owned_event(state, payload["event_id"])
        snapshot = observe_event(run, state, payload["event_id"])
        require(snapshot == {"event": None, "participants": []}, "Deleted event still exists in PPE")
        entry["cleanup_state"] = "deleted"
        control.save(run, state)
        return {"deleted": payload["event_id"]}
    raise RuntimeError("Unknown PPE bridge operation")


def stop_local(run, names=None):
    state = read_run(run)
    issues = []
    for name, record in reversed(list(state["processes"].items())):
        if names is not None and name not in names:
            continue
        identity = control.process_identity(record["pid"])
        if not identity:
            if control.group_members(record["pid"]):
                issues.append(f"{name} leader exited with remaining group members")
            continue
        if identity != record["identity"] or os.getpgid(record["pid"]) != record["pid"]:
            issues.append(f"{name} process ownership changed")
            continue
        os.killpg(record["pid"], signal.SIGTERM)
        deadline = time.monotonic() + 15
        while control.group_members(record["pid"]) and time.monotonic() < deadline:
            time.sleep(0.2)
        if control.group_members(record["pid"]):
            issues.append(f"{name} did not stop")
    return issues


def cleanup(run):
    state = read_run(run)
    issues = stop_local(run, {"browser"})
    pending = [item for item in state["owned_events"] if item["cleanup_state"] == "pending"]
    if pending:
        try:
            record = state["processes"].get("frontend", {})
            if not control.process_identity(record.get("pid", 0)):
                with socket.socket() as listener:
                    listener.bind(("127.0.0.1", 4317))
                launch_frontend(run, state, private_environment())
            doctor(run)
            result = subprocess.run(["node", str(HELPERS / "browser.mjs"), str(run), "--cleanup"],
                                    env=private_environment(), capture_output=True, text=True, timeout=300)
            require(result.returncode == 0, "Owned-event UI cleanup failed; inspect cleanup evidence")
        except Exception:
            issues.append("Owned-event UI cleanup could not prove deletion")
    issues.extend(stop_local(run))
    state = read_run(run)
    pending = [item["event_id"] for item in state["owned_events"] if item["cleanup_state"] == "pending"]
    if pending and not issues:
        issues.append("Owned synthetic events remain")
    state["status"] = "cleanup-incomplete" if issues else "cleaned"
    state["cleanup_issues"] = issues
    control.save(run, state)
    report = {"status": state["status"], "issues": issues, "remaining_event_ids": pending, "remote_resources_deleted": False,
              "cleanup_verifier_fingerprint": verifier_fingerprint(), "verification_verifier_fingerprint": state["verifier_fingerprint"]}
    control.write_json(run / "evidence" / "cleanup.json", report)
    if not issues:
        shutil.rmtree(run / "runtime", ignore_errors=True)
    require(not issues, "PPE cleanup incomplete; retained private runtime and exact owned event IDs")
    return report


def launch_frontend(run, state, env):
    frontend_env = {key: value for key, value in env.items() if key not in ("RAILWAY_TOKEN", "RAILWAY_API_TOKEN", "PPE_SSH_KEY", "PPE_SSH_KNOWN_HOSTS")}
    frontend_env.update({"NODE_ENV": "development", "NEXT_PUBLIC_MOCK_MODE": "off", "MOCK_MODE": "off",
                        "NEXT_PUBLIC_MOCK_DOMAINS": "", "MOCK_DOMAINS": "", "NEXT_PUBLIC_USE_MOCK_API": "false",
                        "NEXT_TELEMETRY_DISABLED": "1", "BACKEND_URL": state["backend_url"],
                        "NEXT_PUBLIC_BACKEND_URL": state["backend_url"], "NEXT_PUBLIC_API_URL": state["backend_url"],
                        "NEXT_PUBLIC_APP_URL": CLIENT_ORIGIN, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "", "NEXT_PUBLIC_GA_MEASUREMENT_ID": ""})
    control.start(run, state, "frontend", ["node", "node_modules/next/dist/bin/next", "dev", "-p", "4317", "-H", "127.0.0.1"], Path(state["source_copy"]) / "client", frontend_env)
    def responding():
        try:
            return http(CLIENT_ORIGIN)[0] == 200
        except RuntimeError:
            return False
    control.wait_for(responding, "fixed frontend", timeout=180)


def verify(args):
    run = args.run.resolve()
    require(not (run / "run.json").exists(), "Run already exists; use a fresh directory")
    target = canonical_target(json.loads(args.target.read_text()))
    frontend = args.frontend_repo.resolve()
    require(subprocess.check_output(["git", "-C", str(frontend), "rev-parse", "HEAD"], text=True).strip() == target["frontend"]["revision"], "Frontend checkout is not the fixed revision")
    require(not subprocess.check_output(["git", "-C", str(frontend), "status", "--porcelain", "--untracked-files=all", "--", "client"], text=True).strip(), "Fixed frontend contains uncommitted client changes")
    repo = args.repo.resolve()
    require(subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip() == target["source"]["revision"], "Backend checkout differs from the source revision")
    require(not subprocess.check_output(["git", "-C", str(repo), "status", "--porcelain", "--untracked-files=all", "--", "server"], text=True).strip(), "Backend contains uncommitted server changes")
    require(control.fingerprint(repo, ("server",)) == target["source"]["server_tree_digest"], "Backend source digest differs from deployment input")
    for name in ("node", "npm", "railway", "ssh", control.LISTENER_TOOL):
        require(shutil.which(name), f"Missing prerequisite {name}")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 4317))
    inspect_target(target)
    run.mkdir(parents=True, exist_ok=True)
    os.chmod(run, 0o700)
    (run / "evidence").mkdir()
    (run / "runtime").mkdir(mode=0o700)
    runtime = run / "runtime"
    shutil.copytree(frontend / "client", runtime / "app" / "client", ignore=control.ignore)
    frontend_digest = control.fingerprint(runtime / "app", ("client",))
    if target["frontend"].get("client_tree_digest"):
        require(target["frontend"]["client_tree_digest"] == frontend_digest, "Frontend digest differs from target")
    state = {"kind": "where2meet-ppe-run-v1", "run_dir": str(run), "run_id": uuid.uuid4().hex, "status": "launching",
             "target": target, "target_digest": digest(target), "source_commit": target["source"]["revision"],
             "source_fingerprint": target["source"]["server_tree_digest"], "frontend_commit": target["frontend"]["revision"],
             "frontend_status": "", "frontend_fingerprint": frontend_digest, "source_copy": str(runtime / "app"),
             "frontend_repo": str(frontend), "client_url": CLIENT_ORIGIN, "backend_url": target["railway"]["backend_origin"],
             "backend_mode": "railway-ppe", "google_keys": {}, "ports": {"frontend": 4317}, "processes": {}, "owned_events": [],
             "verifier_fingerprint": verifier_fingerprint()}
    control.save(run, state)
    passed = False
    try:
        env = control.clean_environment()
        env.update({"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1", "NEXT_TELEMETRY_DISABLED": "1",
                    "NPM_CONFIG_CACHE": os.environ.get("WHERE2MEET_NPM_CACHE", str(runtime / "npm-cache"))})
        log = run / "evidence" / "setup.log"
        control.command(["npm", "ci", "--no-audit", "--no-fund"], runtime / "app" / "client", env, log)
        (runtime / "driver").mkdir()
        for name in ("package.json", "package-lock.json"):
            shutil.copy2(HELPERS / name, runtime / "driver" / name)
        control.command(["npm", "ci", "--no-audit", "--no-fund"], runtime / "driver", env, log)
        launch_frontend(run, state, env)
        state["status"] = "ready"
        control.save(run, state)
        doctor(run)
        require(verifier_fingerprint() == state["verifier_fingerprint"], "Verifier helpers changed during startup; use a fresh run")
        driver = control.start(run, state, "browser", ["node", str(HELPERS / "browser.mjs"), str(run)], HELPERS, private_environment())
        require(driver.wait(timeout=1200) == 0, "PPE browser proof failed; inspect result.json")
        require(verifier_fingerprint() == state["verifier_fingerprint"], "Verifier helpers changed during the browser proof; use a fresh run")
        doctor(run)
        passed = True
    except Exception as error:
        failure = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        control.write_json(run / "evidence" / "verification-failure.json", {"error": failure})
        if (run / "evidence" / "result.json").exists():
            result = json.loads((run / "evidence" / "result.json").read_text())
            result.update({"status": "FAIL", "verification_error": failure})
            control.write_json(run / "evidence" / "result.json", result)
        raise
    finally:
        cleanup(run)
        if passed:
            result = json.loads((run / "evidence" / "result.json").read_text())
            require(result["status"] == "PASS", "PPE result did not pass")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("verify", "doctor", "cleanup", "_bridge"))
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--target", type=Path)
    parser.add_argument("--frontend-repo", type=Path)
    parser.add_argument("--repo", type=Path)
    args = parser.parse_args()
    require(args.operation != "verify" or (args.target and args.frontend_repo and args.repo), "verify requires --target, --repo, and --frontend-repo")
    if args.operation == "verify":
        result = verify(args)
    elif args.operation == "doctor":
        result = doctor(args.run.resolve())
    elif args.operation == "cleanup":
        result = cleanup(args.run.resolve())
    else:
        result = bridge(args.run.resolve(), json.load(sys.stdin))
    print(json.dumps(result))


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        message = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print(json.dumps({"status": "FAIL", "error": message}), file=sys.stderr)
        sys.exit(1)
