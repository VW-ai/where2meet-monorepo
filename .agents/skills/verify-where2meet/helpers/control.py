#!/usr/bin/env python3
"""Run the real Where2Meet app in a disposable local environment."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
import uuid


HELPERS = Path(__file__).resolve().parent
EXCLUDED = {"node_modules", ".next", ".git", "dist", "coverage", ".turbo", "next-env.d.ts"}


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def save(run, state):
    temporary = run / "run.json.tmp"
    write_json(temporary, state)
    temporary.replace(run / "run.json")


def process_identity(pid):
    result = subprocess.run(["ps", "-p", str(pid), "-o", "stat=", "-o", "lstart="],
                            capture_output=True, text=True)
    fields = result.stdout.strip().split(maxsplit=1)
    return fields[1] if result.returncode == 0 and len(fields) == 2 and not fields[0].startswith("Z") else ""


def require_owned_listener(state, name):
    record = state["processes"][name]
    if process_identity(record["pid"]) != record["identity"]:
        raise RuntimeError(f"{name} process identity does not match this run")
    listeners = subprocess.check_output(
        ["lsof", "-t", "-nP", f"-iTCP:{state['ports'][name]}", "-sTCP:LISTEN"], text=True)
    if not listeners.strip() or any(os.getpgid(int(pid)) != record["pid"] for pid in listeners.split()):
        raise RuntimeError(f"{name} port is not owned by this run")


def group_members(group):
    output = subprocess.check_output(["ps", "-axo", "pid=,pgid=,stat="], text=True)
    return [int(pid) for pid, pgid, status in (line.split() for line in output.splitlines())
            if int(pgid) == group and not status.startswith("Z")]


def clean_environment():
    names = ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS")
    return {key: os.environ[key] for key in names if key in os.environ}


def command(args, cwd, env, log):
    with log.open("a") as output:
        result = subprocess.run(args, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(args)}. Read {log}")


def start(run, state, name, args, cwd, env):
    with (run / "evidence" / f"{name}.log").open("a") as output:
        process = subprocess.Popen(args, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                   stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    identity = process_identity(process.pid)
    if not identity:
        raise RuntimeError(f"{name} exited on startup; inspect its log")
    state["processes"][name] = {"pid": process.pid, "identity": identity, "command": args}
    save(run, state)
    return process


def free_ports():
    sockets = []
    try:
        for _ in range(4):
            sock = socket.socket()
            sock.bind(("127.0.0.1", 0))
            sockets.append(sock)
        return [sock.getsockname()[1] for sock in sockets]
    finally:
        for sock in sockets:
            sock.close()


def response(url):
    with urllib.request.urlopen(url, timeout=8) as result:
        return result.status, result.read()


def wait_for(check, label, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
        time.sleep(0.5)
    raise RuntimeError(f"Timed out waiting for {label}")


def fingerprint(root, packages=("client", "server")):
    result = hashlib.sha256()
    for package in packages:
        for path in sorted((root / package).rglob("*")):
            relative = path.relative_to(root)
            if any(part in EXCLUDED or part.startswith(".env") for part in relative.parts):
                continue
            if path.is_file():
                result.update(str(relative).encode())
                result.update(path.read_bytes())
    return result.hexdigest()


def ignore(_directory, names):
    return [name for name in names if name in EXCLUDED or name.startswith(".env")]


def load(run):
    state = json.loads((run / "run.json").read_text())
    if state["run_dir"] != str(run) or state["kind"] != "where2meet-verification-v1":
        raise RuntimeError("This directory is not an owned Where2Meet verification run")
    return state


def cleanup(run):
    state = load(run)
    issues = []
    for name, record in reversed(list(state["processes"].items())):
        current = process_identity(record["pid"])
        if not current:
            if group_members(record["pid"]):
                issues.append(f"{name}: leader exited but group members remain; scratch retained")
            continue
        if current != record["identity"]:
            issues.append(f"{name}: PID identity changed; not signaled")
            continue
        try:
            if os.getpgid(record["pid"]) != record["pid"]:
                issues.append(f"{name}: process group ownership changed; not signaled")
                continue
            os.killpg(record["pid"], signal.SIGTERM)
        except ProcessLookupError:
            if group_members(record["pid"]):
                issues.append(f"{name}: process exited during cleanup with group members remaining")
            continue
        deadline = time.monotonic() + 12
        while group_members(record["pid"]) and time.monotonic() < deadline:
            time.sleep(0.2)
        if group_members(record["pid"]):
            issues.append(f"{name}: did not stop; scratch state retained")
    if not issues:
        shutil.rmtree(run / "runtime", ignore_errors=True)
        state["status"] = "cleaned"
    else:
        state["status"] = "cleanup-incomplete"
    state["cleanup_issues"] = issues
    save(run, state)
    write_json(run / "evidence" / "cleanup.json", {
        "status": state["status"], "issues": issues,
        "evidence_files": sorted(p.name for p in (run / "evidence").iterdir()),
    })
    if issues:
        raise RuntimeError("; ".join(issues))
    print(f"Cleaned owned instances and scratch data. Evidence remains at {run / 'evidence'}")


def doctor(run):
    state = load(run)
    if state["status"] not in ("launching", "ready"):
        raise RuntimeError(f"Run is {state['status']}; do not drive it")
    for name in state["ports"]:
        require_owned_listener(state, name)
    ready = json.loads(response(state["backend_url"] + "/health/ready")[1])
    if ready["status"] != "ok" or ready["services"] != {"database": "ok", "redis": "ok"}:
        raise RuntimeError(f"Backend is not ready: {ready}")
    if response(state["client_url"])[0] != 200:
        raise RuntimeError("Frontend is not responding")
    try:
        status, body = response(state["client_url"] + "/api/auth/session")
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read()
    if status != 401:
        raise RuntimeError(f"Fresh anonymous session should be unauthorized, got {status}")
    if fingerprint(Path(state["source_copy"])) != state["source_fingerprint"]:
        raise RuntimeError("Verification source changed after launch; start a new run")
    result = {"status": "PASS", "source_commit": state["source_commit"],
              "source_status": state["source_status"], "frontend_commit": state["frontend_commit"],
              "frontend_status": state["frontend_status"], "frontend_fingerprint": state["frontend_fingerprint"],
              "source_fingerprint": state["source_fingerprint"], "client_url": state["client_url"],
              "backend_url": state["backend_url"], "health": ready,
              "anonymous_session_status": status, "mocks": "off", "process_ownership": "verified",
              "schema_mode": state.get("schema_mode", "push"),
              "backend_mode": state.get("backend_mode", "source")}
    write_json(run / "evidence" / "doctor.json", result)
    print(json.dumps(result, indent=2))


def restart_backend(run):
    doctor(run)
    state = load(run)
    record = state["processes"]["backend"]
    os.killpg(record["pid"], signal.SIGTERM)
    wait_for(lambda: not group_members(record["pid"]), "backend shutdown", timeout=15)
    env = {**clean_environment(), "DATABASE_URL": state["database_url"],
           "REDIS_URL": f"redis://127.0.0.1:{state['ports']['redis']}",
           "HOST": "127.0.0.1", "PORT": str(state["ports"]["backend"]),
           "NODE_ENV": "development", "CORS_ORIGINS": state["client_url"],
           "GOOGLE_MAPS_API_KEY": os.environ.get("GOOGLE_MAPS_API_KEY", "")}
    start(run, state, "backend", record["command"], Path(state["source_copy"]) / "server", env)
    wait_for(lambda: json.loads(response(state["backend_url"] + "/health/ready")[1])["status"] == "ok", "restarted backend")
    doctor(run)
    write_json(run / "evidence" / "backend-restart.json", {
        "status": "PASS", "previous_pid": record["pid"],
        "current_pid": state["processes"]["backend"]["pid"],
        "database_reused": True, "source_fingerprint": state["source_fingerprint"],
    })


def launch(run, repo, frontend_repo, schema_mode, backend_mode):
    if (run / "run.json").exists():
        raise RuntimeError("Run already exists. Use a new run directory, or doctor/cleanup the existing run")
    for name in ("node", "npm", "initdb", "postgres", "pg_isready", "createdb", "psql", "redis-server", "redis-cli", "lsof", "git"):
        if not shutil.which(name):
            raise RuntimeError(f"Missing prerequisite: {name}")
    major = int(subprocess.check_output(["node", "-p", "process.versions.node.split('.')[0]"], text=True))
    if major not in (20, 22, 24):
        raise RuntimeError("Use Node 20, 22, or 24 LTS; this repository's test dependencies exclude Node 23")
    for name in ("client", "server"):
        source = frontend_repo if name == "client" else repo
        if not (source / name / "package-lock.json").exists():
            raise RuntimeError(f"Not the expected monorepo: missing {name}/package-lock.json")
    (run / "evidence").mkdir(parents=True)
    runtime = run / "runtime"
    runtime.mkdir()
    api_port, web_port, pg_port, redis_port = free_ports()
    state = {"kind": "where2meet-verification-v1", "run_dir": str(run), "status": "launching",
             "run_id": uuid.uuid4().hex, "source_repo": str(repo), "source_copy": str(runtime / "app"),
             "source_commit": subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip(),
             "frontend_repo": str(frontend_repo),
             "frontend_commit": subprocess.check_output(["git", "-C", str(frontend_repo), "rev-parse", "HEAD"], text=True).strip(),
             "frontend_status": subprocess.check_output(["git", "-C", str(frontend_repo), "status", "--short", "--", "client"], text=True),
             "source_status": subprocess.check_output(["git", "-C", str(repo), "status", "--short"], text=True),
             "ports": {"backend": api_port, "frontend": web_port, "postgres": pg_port, "redis": redis_port},
             "backend_url": f"http://127.0.0.1:{api_port}", "client_url": f"http://127.0.0.1:{web_port}",
             "database_url": f"postgresql://verify@127.0.0.1:{pg_port}/where2meet_verify",
             "schema_mode": schema_mode, "backend_mode": backend_mode, "processes": {}}
    save(run, state)
    try:
        for name in ("client", "server"):
            source = frontend_repo if name == "client" else repo
            shutil.copytree(source / name, runtime / "app" / name, ignore=ignore)
        state["source_fingerprint"] = fingerprint(runtime / "app")
        state["frontend_fingerprint"] = fingerprint(runtime / "app", ("client",))
        state["versions"] = {name: subprocess.check_output(args, text=True).strip() for name, args in {
            "node": ["node", "--version"], "postgres": ["postgres", "--version"], "redis": ["redis-server", "--version"]}.items()}
        state["google_keys"] = {key: bool(os.environ.get(key)) for key in ("GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")}
        save(run, state)
        env = clean_environment()
        env.update({"NPM_CONFIG_CACHE": os.environ.get("WHERE2MEET_NPM_CACHE", str(runtime / "npm-cache")),
                    "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1", "NEXT_TELEMETRY_DISABLED": "1"})
        log = run / "evidence" / "setup.log"
        for name in ("server", "client"):
            command(["npm", "ci", "--no-audit", "--no-fund"], runtime / "app" / name, env, log)
        driver = runtime / "driver"
        driver.mkdir()
        for name in ("package.json", "package-lock.json"):
            shutil.copy2(HELPERS / name, driver / name)
        command(["npm", "ci", "--no-audit", "--no-fund"], driver, env, log)
        command(["initdb", "-D", str(runtime / "pgdata"), "-U", "verify", "--auth=trust", "--no-locale", "--encoding=UTF8"], runtime, env, log)
        start(run, state, "postgres", ["postgres", "-D", str(runtime / "pgdata"), "-h", "127.0.0.1", "-p", str(pg_port), "-k", ""], runtime, env)
        wait_for(lambda: subprocess.run(["pg_isready", "-h", "127.0.0.1", "-p", str(pg_port)], capture_output=True).returncode == 0, "PostgreSQL")
        require_owned_listener(state, "postgres")
        command(["createdb", "-h", "127.0.0.1", "-p", str(pg_port), "-U", "verify", "where2meet_verify"], runtime, env, log)
        start(run, state, "redis", ["redis-server", "--bind", "127.0.0.1", "--port", str(redis_port), "--save", "", "--appendonly", "no"], runtime, env)
        wait_for(lambda: subprocess.run(["redis-cli", "-h", "127.0.0.1", "-p", str(redis_port), "ping"], capture_output=True).stdout.strip() == b"PONG", "Redis")
        require_owned_listener(state, "redis")
        server_env = {**env, "DATABASE_URL": state["database_url"], "REDIS_URL": f"redis://127.0.0.1:{redis_port}",
                      "HOST": "127.0.0.1", "PORT": str(api_port), "NODE_ENV": "development", "CORS_ORIGINS": state["client_url"],
                      "GOOGLE_MAPS_API_KEY": os.environ.get("GOOGLE_MAPS_API_KEY", "")}
        server = runtime / "app" / "server"
        command(["npm", "run", "db:generate"], server, server_env, log)
        require_owned_listener(state, "postgres")
        schema_command = ["npx", "--no-install", "prisma", "migrate", "deploy"] if schema_mode == "migrations" else ["npm", "run", "db:push"]
        command(schema_command, server, server_env, log)
        if backend_mode == "compiled":
            command(["npm", "run", "build"], server, server_env, log)
        backend_command = ["node", "dist/index.js"] if backend_mode == "compiled" else ["node", "--import", "tsx", "src/index.ts"]
        start(run, state, "backend", backend_command, server, server_env)
        wait_for(lambda: json.loads(response(state["backend_url"] + "/health/ready")[1])["status"] == "ok", "backend")
        client_env = {**env, "NODE_ENV": "development", "NEXT_PUBLIC_MOCK_MODE": "off", "MOCK_MODE": "off",
                      "NEXT_PUBLIC_MOCK_DOMAINS": "", "MOCK_DOMAINS": "", "NEXT_PUBLIC_USE_MOCK_API": "false",
                      "BACKEND_URL": state["backend_url"], "NEXT_PUBLIC_BACKEND_URL": state["backend_url"],
                      "NEXT_PUBLIC_API_URL": state["backend_url"], "NEXT_PUBLIC_APP_URL": state["client_url"],
                      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": os.environ.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", ""),
                      "NEXT_PUBLIC_GA_MEASUREMENT_ID": ""}
        start(run, state, "frontend", ["node", "node_modules/next/dist/bin/next", "dev", "-p", str(web_port), "-H", "127.0.0.1"], runtime / "app" / "client", client_env)
        wait_for(lambda: response(state["client_url"])[0] == 200, "frontend", timeout=180)
        state["status"] = "ready"
        save(run, state)
        doctor(run)
        print(f"RUN_DIR={run}")
    except BaseException as error:
        write_json(run / "evidence" / "launch-failure.json", {"error": str(error)})
        try:
            cleanup(run)
        except Exception as cleanup_error:
            print(f"Cleanup also needs attention: {cleanup_error}", file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("launch", "doctor", "drive", "cleanup", "restart-backend"))
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--frontend-repo", type=Path, help="Pinned original frontend checkout during backend migration")
    parser.add_argument("--schema-mode", choices=("migrations", "push"), default="migrations",
                        help="Use push only to reproduce the legacy schema baseline")
    parser.add_argument("--backend-mode", choices=("compiled", "source"), default="compiled")
    args = parser.parse_args()
    run = args.run.resolve()
    if args.operation == "launch":
        if args.frontend_repo and subprocess.check_output(
                ["git", "-C", str(args.frontend_repo.resolve()), "status", "--short", "--", "client"], text=True).strip():
            raise RuntimeError("The explicitly pinned frontend has uncommitted changes; use a clean baseline checkout")
        launch(run, args.repo.resolve(), (args.frontend_repo or args.repo).resolve(), args.schema_mode, args.backend_mode)
    elif args.operation == "doctor":
        doctor(run)
    elif args.operation == "cleanup":
        cleanup(run)
    elif args.operation == "restart-backend":
        restart_backend(run)
    else:
        try:
            doctor(run)
            state = load(run)
            process = start(run, state, "browser", ["node", str(HELPERS / "browser.mjs"), str(run)],
                            HELPERS, clean_environment())
            if process.wait(timeout=300):
                raise RuntimeError(f"Browser verification failed; read {run / 'evidence' / 'result.json'}")
            print((run / "evidence" / "result.json").read_text())
        except BaseException as error:
            write_json(run / "evidence" / "drive-failure.json", {"error": str(error)})
            try:
                cleanup(run)
            except Exception as cleanup_error:
                print(f"Cleanup also needs attention: {cleanup_error}", file=sys.stderr)
            raise


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda _number, _frame: sys.exit(143))
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
