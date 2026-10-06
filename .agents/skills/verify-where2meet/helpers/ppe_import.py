#!/usr/bin/env python3
"""Run the populated import proof against one receipt-owned Railway PPE trio."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys
import time
import urllib.parse
import uuid

import control
import ppe

KIND = "where2meet-remote-import-run-v1"
PROTECTED = {"27346658-ce2f-4da5-a999-7c4cb549f9a0", "d1eaf58e-bcdf-4717-8a67-33874c907739", "6e5789ef-1f5d-4084-bcf4-24bb8591f94d"}
ROLES = ("backend", "postgres", "redis")
require = ppe.require
HELPERS = Path(__file__).resolve().parent
BOOTSTRAP = "import json,os,sys; line=sys.stdin.buffer.readline(); argv=json.loads(line) if line else None; sys.exit(0) if argv is None else os.execvpe(argv[0],argv,os.environ)"


def private_json(path):
    details = path.lstat()
    require(path.is_file() and not path.is_symlink() and details.st_uid == os.getuid() and details.st_nlink == 1 and details.st_mode & 0o777 == 0o600, "Private ownership file mode or identity changed")
    return json.loads(path.read_text())


def write_private(path, value):
    with open(path, "x", opener=lambda name, flags: os.open(name, flags, 0o600)) as output:
        json.dump(value, output, sort_keys=True)
        output.flush()
        os.fsync(output.fileno())


def save(run, state):
    temporary = run / "run.json.tmp"
    with temporary.open("w") as output:
        json.dump(state, output, sort_keys=True)
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(run / "run.json")
    descriptor = os.open(run, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def process_identity(pid):
    result = subprocess.run(["ps", "-p", str(pid), "-o", "stat=", "-o", "lstart="], capture_output=True, text=True)
    fields = result.stdout.strip().split(maxsplit=1)
    require((result.returncode == 0 and len(fields) == 2) or
            (result.returncode == 1 and not result.stdout.strip() and not result.stderr.strip()), "Process ownership inspection unavailable")
    return fields[1] if result.returncode == 0 and not fields[0].startswith("Z") else ""


def process_owner():
    identity = process_identity(os.getpid())
    require(bool(identity), "Current controller process identity unavailable")
    return {"pid": os.getpid(), "identity": identity}


def canonical_owner(raw, target):
    require(raw.get("kind") == "where2meet-m5-resource-owner-v1" and raw.get("project") == ppe.PROJECT and raw.get("environment") == ppe.ENVIRONMENT, "Resource receipt is outside authorized PPE")
    require(Path(raw.get("setup_dir", "")).is_absolute() and raw.get("status") == "accepted", "Setup receipt is not a completed upload")
    initial = raw.get("initial_service_ids", [])
    require(isinstance(initial, list) and PROTECTED <= set(initial), "Resource receipt lacks accepted PPE baseline IDs")
    require(set(raw.get("services", {})) == set(ROLES), "Resource receipt must contain exactly three roles")
    services = {}
    for role in ROLES:
        entry = raw["services"][role]
        identifier = str(uuid.UUID(entry["id"]))
        require(identifier not in set(initial) | PROTECTED and identifier == target["railway"][role + "_service_id"], "Resource receipt selects an existing or different service")
        require(re.fullmatch(r"m5-import-[0-9a-f]{10}-" + role, entry["name"]), "Resource receipt has an unexpected planned name")
        require(raw.get("actions", []).count({"intent": "create empty " + role + " named " + entry["name"], "status": "returned"}) == 1, "Resource creation intent was not confirmed")
        require(entry.get("deployment", {}).get("status") == "SUCCESS", "Setup resource is not successfully deployed")
        services[role] = {"id": identifier, "name": entry["name"]}
    require(len({entry["id"] for entry in services.values()}) == 3 and len({entry["name"].rsplit("-", 1)[0] for entry in services.values()}) == 1, "Resource roles do not describe one distinct trio")
    require(raw.get("source") == target["source"] and raw.get("backend_origin") == target["railway"]["backend_origin"], "Resource source or origin differs from target")
    volume = str(uuid.UUID(raw["services"]["postgres"]["volume_id"]))
    require(raw["services"]["postgres"].get("planned_volume_mount_path") == "/var/lib/postgresql/data", "Unexpected PostgreSQL mount")
    deployment = target["railway"]["deployment_id"]
    backend = raw["services"]["backend"]
    require(raw.get("uploaded_deployment_id") == deployment == backend["deployment"]["id"] and
            any(row.get("deploymentId") == deployment for row in raw.get("upload", [])), "Source upload and active deployment differ")
    image = backend.get("deployment_provenance", {}).get("image_digest", "")
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", image), "Setup image digest unavailable")
    return {"services": services, "postgres_volume_id": volume, "initial_service_ids": sorted(initial),
            "setup_directory": raw["setup_dir"], "backend_image": image, "setup_digest": ppe.digest(raw)}


def read_run(run):
    state = private_json(run / "run.json")
    require(state.get("kind") == KIND and state.get("run_dir") == str(run), "Not an owned remote import run")
    initial = ppe.canonical_target(state["initial_target"])
    target = ppe.canonical_target(state["target"])
    require(target == initial and ppe.digest(target) == state["target_digest"], "Remote target changed")
    require(canonical_owner(private_json(run / "resource-owner.json"), initial) == state["owner"], "Copied resource ownership changed")
    require(state["resource_consumer"] == {"kind": "where2meet-remote-import-consumer-v1", "run_dir": str(run), "run_id": state["run_id"], "owner_digest": state["owner"]["setup_digest"], "controller": state["controller"]}, "Resource consumer does not own this controller")
    consumer = Path(state["consumer_path"])
    require(consumer == Path(state["owner"]["setup_directory"]) / "import-consumer.json", "Resource consumer directory changed")
    if not consumer.exists():
        owner = state["controller"]
        require(owner["pid"] == os.getpid() or process_identity(owner["pid"]) != owner["identity"], "Active controller has not finished its resource claim")
        write_private(consumer, state["resource_consumer"])
    require(state["resource_consumer"] == private_json(consumer), "Resource consumer receipt changed")
    require(state.get("ports") == {"frontend": 4317} and state["source_copy"] == str(run / "runtime/app") and
            state["backend_url"] == target["railway"]["backend_origin"] and state["client_url"] == ppe.CLIENT_ORIGIN and "database_url" not in state, "Remote runtime boundaries changed")
    return state


def caller_is_proof(state):
    for name in ("proof", "recovery"):
        owner = state["processes"].get(name, {})
        if owner.get("pid") == os.getppid() and process_identity(os.getppid()) == owner.get("identity"):
            return True
    return False


def provider(state, operation, role=None, mutation=None):
    scope = ["--project", ppe.PROJECT, "--environment", ppe.ENVIRONMENT]
    command = ["railway", "volume", *scope, *operation[1:]] if operation[0] == "volume" else ["railway", *operation, *scope]
    if role:
        command += ["--service", state["owner"]["services"][role]["id"]]
    if mutation:
        state["resource_actions"].append({"operation": mutation, "status": "pending"})
        save(Path(state["run_dir"]), state)
    result = subprocess.run(command, env=ppe.private_environment(), capture_output=True, text=True, timeout=60)
    require(result.returncode == 0, "Scoped provider operation failed; raw output withheld")
    if mutation:
        state["resource_actions"][-1]["status"] = "returned"
        save(Path(state["run_dir"]), state)
    return json.loads(result.stdout) if "--json" in operation else None


def resource_inventory(state):
    status = provider(state, ["status", "--json"])
    require(status.get("id") == ppe.PROJECT, "Project inventory changed")
    environments = ppe.nodes(status["environments"])
    selected = [entry for entry in environments if entry["id"] == ppe.ENVIRONMENT]
    require(len(selected) == 1 and selected[0]["name"] == "ppe", "PPE environment inventory changed")
    names = {entry["id"]: entry["name"] for entry in ppe.nodes(status["services"])}
    instances = {entry["serviceId"]: entry for entry in ppe.nodes(selected[0]["serviceInstances"])}
    for role, owned in state["owner"]["services"].items():
        identifier = owned["id"]
        require(identifier not in PROTECTED and identifier not in state["owner"]["initial_service_ids"], "Existing PPE resource disposal refused")
        if identifier in names:
            require(names[identifier] == owned["name"], "Owned resource name changed")
        for environment in environments:
            if environment["id"] != ppe.ENVIRONMENT:
                require(identifier not in {item["serviceId"] for item in ppe.nodes(environment.get("serviceInstances", {}))}, "Owned service now exists in another environment")
    baseline = {identifier: {"name": names[identifier], "source": instances[identifier].get("source"),
        "deployment": (instances[identifier].get("latestDeployment") or {}).get("id"), "domains": instances[identifier].get("domains")}
        for identifier in state["owner"]["initial_service_ids"] if identifier in names and identifier in instances}
    require(len(baseline) == len(state["owner"]["initial_service_ids"]), "Accepted PPE resources disappeared")
    if state.get("accepted_baseline"):
        require(baseline == state["accepted_baseline"], "Accepted PPE resource metadata changed")
    volume_list = provider(state, ["volume", "list", "--json"])
    require(isinstance(volume_list, dict) and volume_list.get("environment") == "ppe" and volume_list.get("project") == status.get("name") and isinstance(volume_list.get("volumes"), list), "Volume inventory shape unavailable")
    volumes = [entry for entry in volume_list["volumes"] if not entry.get("deletedAt")]
    owned = [entry for entry in volumes if entry["id"] == state["owner"]["postgres_volume_id"]]
    require(len(owned) <= 1, "Owned volume inventory is ambiguous")
    if owned:
        attached = state["owner"]["services"]["postgres"]["id"] in instances
        require(owned[0].get("serviceName") == (state["owner"]["services"]["postgres"]["name"] if attached else None) and
                owned[0].get("mountPath") == "/var/lib/postgresql/data", "Owned volume attachment changed")
    return {"services": names, "instances": instances, "volumes": volumes, "baseline": baseline}


def inspect(run, frontend=True):
    state = read_run(run)
    evidence, variables = ppe.inspect_target(state["target"])
    inventory = resource_inventory(state)
    ids = state["owner"]["services"]
    backend = inventory["instances"][ids["backend"]["id"]]
    deployment = backend["latestDeployment"]
    image = (deployment.get("meta") or {}).get("imageDigest")
    require(isinstance(image, str) and image.startswith("sha256:"), "Backend image identity unavailable")
    require(image == state["owner"]["backend_image"], "Backend image changed")
    evidence.update({"backend_image": image, "backend_service_instance_id": backend["id"],
        "backend_instances": sorted(item["id"] for item in deployment.get("instances", []) if item.get("status") == "RUNNING")})
    require(evidence["backend_instances"], "Backend running instance identity unavailable")
    require(any(entry["id"] == state["owner"]["postgres_volume_id"] for entry in inventory["volumes"]), "Owned PostgreSQL volume absent")
    if frontend:
        ppe.assert_frontend(state)
        require(control.fingerprint(Path(state["source_copy"]), ("server",)) == state["source_fingerprint"], "Importer source changed")
        require_owned_tunnel(state)
    with (run / "evidence/identity-checks.jsonl").open("a") as output:
        output.write(json.dumps(evidence) + "\n")
    return evidence, variables, inventory


def start_owned(run, state, name, command, cwd, environment):
    child = subprocess.Popen([sys.executable, "-c", BOOTSTRAP], cwd=cwd, env=environment, stdin=subprocess.PIPE,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        state["processes"][name] = {"pid": child.pid, "identity": process_identity(child.pid), "command": [name]}
        require(bool(state["processes"][name]["identity"]), "Child process identity unavailable")
        save(run, state)
        child.stdin.write((json.dumps(command) + "\n").encode())
    except BaseException:
        child.stdin.close()
        child.wait(timeout=10)
        raise
    child.stdin.close()
    return child


def ssh_arguments(instance):
    key = Path(os.environ.get("PPE_SSH_KEY", ""))
    hosts = Path(os.environ.get("PPE_SSH_KNOWN_HOSTS", ""))
    require(key.is_file() and not key.is_symlink() and key.stat().st_mode & 0o077 == 0 and hosts.is_file(), "Private SSH identity or verified hosts missing")
    require(re.fullmatch(r"[0-9a-f-]{36}", instance), "SSH service instance identity invalid")
    return ["ssh", "-T", "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
            "-o", "ConnectTimeout=15", "-o", "UserKnownHostsFile=" + str(hosts), "-i", str(key)], instance + "@ssh.railway.com"


def tunnel_url(raw, port):
    parsed = urllib.parse.urlsplit(raw)
    require(parsed.scheme in ("postgres", "postgresql") and parsed.port == 5432 and parsed.username and parsed.password and
            parsed.hostname and parsed.hostname.endswith(".railway.internal") and parsed.path == "/where2meet_import" and not parsed.fragment,
            "Owned PostgreSQL URL has unexpected authority or database")
    authority = parsed.netloc.rsplit("@", 1)[0] + "@127.0.0.1:" + str(port)
    return urllib.parse.urlunsplit((parsed.scheme, authority, parsed.path, parsed.query, ""))


def require_owned_tunnel(state):
    record = state["processes"]["database-tunnel"]
    require(process_identity(record["pid"]) == record["identity"], "SSH tunnel process identity changed")
    port = state["tunnel"]["port"]
    require(isinstance(port, int) and 1024 < port < 65536, "Tunnel port invalid")
    control.require_owned_listener({"processes": {"database-tunnel": record}, "ports": {"database-tunnel": port}}, "database-tunnel")
    if control.LISTENER_TOOL == "ss":
        output = subprocess.check_output(["ss", "-H", "-ltnp", f"sport = :{port}"], text=True)
        addresses = {line.split()[3] for line in output.splitlines()}
    else:
        output = subprocess.check_output(["lsof", "-nP", "-a", "-p", str(record["pid"]), f"-iTCP:{port}", "-sTCP:LISTEN", "-Fn"], text=True)
        addresses = {line[1:] for line in output.splitlines() if line.startswith("n")}
    require(addresses == {f"127.0.0.1:{port}"}, "SSH database tunnel is not strictly loopback")


def runtime_observation(run):
    before, _, _ = inspect(run)
    command, destination = ssh_arguments(before["backend_service_instance_id"])
    script = "const fs=require(\"node:fs\");const stat=fs.readFileSync(\"/proc/1/stat\",\"utf8\");process.stdout.write(JSON.stringify({milliseconds:Date.now(),hostname:require(\"node:os\").hostname(),startTicks:stat.slice(stat.lastIndexOf(\")\")+2).split(/\\s+/)[19]}))"
    started = time.time_ns() // 1_000_000
    result = subprocess.run([*command, destination, "node -e '" + script + "'"],
                            env=ppe.private_environment(), capture_output=True, text=True, timeout=30)
    ended = time.time_ns() // 1_000_000
    require(result.returncode == 0 and 0 <= ended - started <= 10000, "Backend observation unavailable or too imprecise")
    value = json.loads(result.stdout)
    require(set(value) == {"milliseconds", "hostname", "startTicks"} and isinstance(value["milliseconds"], int) and
            re.fullmatch(r"[a-zA-Z0-9._-]{1,100}", value["hostname"]) and re.fullmatch(r"[0-9]+", value["startTicks"]), "Backend observation response invalid")
    after, _, _ = inspect(run)
    require(before["deployment_id"] == after["deployment_id"] and before["backend_image"] == after["backend_image"], "Backend changed during runtime observation")
    return {"clock": {"started": started, "ended": ended, "server": value["milliseconds"]},
            "process": {"hostname": value["hostname"], "pid1_start_ticks": value["startTicks"]}, "identity": after}


def backend_clock(run):
    return runtime_observation(run)["clock"]


def restart(run):
    state = read_run(run)
    before = runtime_observation(run)
    provider(state, ["service", "restart", "--yes", "--json"], "backend", "restart owned backend once")
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            after = runtime_observation(run)
        except (RuntimeError, subprocess.TimeoutExpired):
            time.sleep(1)
            continue
        require(after["identity"]["deployment_id"] == before["identity"]["deployment_id"] and
                after["identity"]["backend_image"] == before["identity"]["backend_image"] and
                after["identity"]["postgres_service_instance_id"] == before["identity"]["postgres_service_instance_id"], "Restart changed deployment, image or database")
        if after["process"] != before["process"] and ppe.http(state["backend_url"] + "/health/ready")[0] == 200:
            receipt = {"status": "PASS", "before": before, "after": after, "process_changed": True, "same_image": True}
            control.write_json(run / "evidence/backend-restart.json", receipt)
            return receipt
        time.sleep(1)
    raise RuntimeError("Restart had no observed new PID1 identity; no automatic retry")


def stop_processes(run, state, names):
    for name in names:
        record = state["processes"].get(name)
        if not record:
            continue
        current = process_identity(record["pid"])
        if not current:
            require(not control.group_members(record["pid"]), "Owned leader exited with surviving process group")
            continue
        require(current == record["identity"] and os.getpgid(record["pid"]) == record["pid"], "Local process ownership changed; not signaled")
        os.killpg(record["pid"], signal.SIGTERM)
        control.wait_for(lambda: not control.group_members(record["pid"]), "owned import process shutdown", timeout=15)


def dispose(run):
    state = read_run(run)
    inventory = resource_inventory(state)
    stop_processes(run, state, ("frontend", "database-tunnel"))
    for role in ("backend", "redis", "postgres"):
        identifier = state["owner"]["services"][role]["id"]
        inventory = resource_inventory(state)
        if identifier in inventory["instances"]:
            try:
                provider(state, ["service", "delete", "--yes", "--json"], role, "delete owned " + role)
            except Exception:
                inventory = resource_inventory(state)
                require(identifier not in inventory["instances"], "Service delete reply lost and absence unproven; use cleanup only")
        inventory = resource_inventory(state)
        require(identifier not in inventory["instances"], "Owned service still exists in PPE")
    volume = state["owner"]["postgres_volume_id"]
    inventory = resource_inventory(state)
    if any(entry["id"] == volume for entry in inventory["volumes"]):
        try:
            provider(state, ["volume", "delete", "--volume", volume, "--yes", "--json"], mutation="delete owned PostgreSQL volume")
        except Exception:
            require(not any(entry["id"] == volume for entry in resource_inventory(state)["volumes"]), "Volume delete reply lost and absence unproven")
    final = resource_inventory(state)
    require(not any(entry["id"] == volume for entry in final["volumes"]), "Owned PostgreSQL volume remains")
    ids = {entry["id"] for entry in state["owner"]["services"].values()}
    require(not ids & final["services"].keys(), "Owned project service records remain; root must inspect provider deletion semantics")
    state["status"] = "disposed"
    save(run, state)
    shutil.rmtree(run / "runtime", ignore_errors=True)
    report = {"status": "PASS", "service_ids_absent": sorted(ids), "volume_id_absent": volume,
              "accepted_ppe_unchanged": True, "local_processes_stopped": True, "ssh_key_revocation": "root-owned separate receipt required"}
    control.write_json(run / "evidence/resource-cleanup.json", report)
    return report


def cleanup(run):
    state = read_run(run)
    original = state["controller"]
    require(original["pid"] == os.getpid() or process_identity(original["pid"]) != original["identity"], "Original import controller is still active")
    stop_processes(run, state, ("proof", "recovery"))
    if (run / "migration-owner.json").exists():
        recovery = start_owned(run, state, "recovery", ["node", str(HELPERS / "migration-proof.mjs"), str(run), state["fixture_dir"], "--cleanup-only"], HELPERS, ppe.private_environment())
        require(recovery.wait(timeout=600) == 0, "Remote import cleanup incomplete; retain private receipts")
        return json.loads((run / "evidence/resource-cleanup.json").read_text())
    descriptor = control.acquire_cleanup_lock(run)
    try:
        return dispose(run)
    finally:
        os.close(descriptor)


def verify(args):
    run = args.run.resolve()
    require(not (run / "run.json").exists(), "Remote import run already exists; use cleanup only")
    require(all(getattr(args, name) is not None for name in ("target", "owner", "fixture", "repo", "frontend_repo")), "Verify requires target, owner, fixture and both source checkouts")
    target = ppe.canonical_target(json.loads(args.target.read_text()))
    owner_path = args.owner.resolve()
    raw_owner = private_json(owner_path)
    owner = canonical_owner(raw_owner, target)
    require(owner_path.parent == Path(owner["setup_directory"]), "Setup receipt was moved from its owning directory")
    require(bool(os.environ.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")), "Real browser Google key required")
    for root, package, revision in ((args.repo.resolve(), "server", target["source"]["revision"]), (args.frontend_repo.resolve(), "client", target["frontend"]["revision"])):
        require(subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip() == revision and
                not subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=all", "--", package], text=True).strip(), "Import or frontend checkout is not clean and pinned")
    require(control.fingerprint(args.repo.resolve(), ("server",)) == target["source"]["server_tree_digest"], "Importer source digest differs from deployment")
    ppe.inspect_target(target)
    run.mkdir(parents=True, exist_ok=True)
    os.chmod(run, 0o700)
    (run / "evidence").mkdir()
    (run / "runtime").mkdir(mode=0o700)
    controller = process_owner()
    consumer = {"kind": "where2meet-remote-import-consumer-v1", "run_dir": str(run), "run_id": uuid.uuid4().hex, "owner_digest": owner["setup_digest"], "controller": controller}
    state = {"kind": KIND, "run_dir": str(run), "run_id": consumer["run_id"], "status": "launching", "controller": controller,
        "owner": owner, "initial_target": target, "target": target, "target_digest": ppe.digest(target), "resource_consumer": consumer,
        "consumer_path": str(owner_path.parent / "import-consumer.json"), "fixture_dir": str(args.fixture.resolve()),
        "source_commit": target["source"]["revision"], "source_fingerprint": target["source"]["server_tree_digest"], "source_status": "",
        "frontend_commit": target["frontend"]["revision"], "frontend_status": "", "source_copy": str(run / "runtime/app"),
        "backend_url": target["railway"]["backend_origin"], "client_url": ppe.CLIENT_ORIGIN, "ports": {"frontend": 4317}, "processes": {},
        "backend_mode": "railway-ppe", "schema_mode": "migrations", "resource_actions": []}
    write_private(run / "resource-owner.json", raw_owner)
    save(run, state)
    write_private(Path(state["consumer_path"]), consumer)
    try:
        inventory = resource_inventory(state)
        state["accepted_baseline"] = inventory["baseline"]
        save(run, state)
        runtime = run / "runtime"
        for source, package in ((args.repo, "server"), (args.frontend_repo, "client")):
            shutil.copytree(source.resolve() / package, runtime / "app" / package, ignore=control.ignore)
        state["frontend_fingerprint"] = control.fingerprint(runtime / "app", ("client",))
        env = {**control.clean_environment(), "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1", "NEXT_TELEMETRY_DISABLED": "1", "NPM_CONFIG_CACHE": os.environ.get("WHERE2MEET_NPM_CACHE", str(runtime / "npm-cache"))}
        for package in ("server", "client"):
            control.command(["npm", "ci", "--no-audit", "--no-fund"], runtime / "app" / package, env, run / "evidence/setup.log")
        control.command(["npx", "prisma", "generate"], runtime / "app/server",
                        {**env, "DATABASE_URL": "postgresql://generation@127.0.0.1:1/where2meet_generate"}, run / "evidence/setup.log")
        (runtime / "driver").mkdir()
        for name in ("package.json", "package-lock.json"):
            shutil.copy2(HELPERS / name, runtime / "driver" / name)
        control.command(["npm", "ci", "--no-audit", "--no-fund"], runtime / "driver", env, run / "evidence/setup.log")
        evidence, variables, _ = inspect(run, frontend=False)
        state["backend_image"] = evidence["backend_image"]
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        state["tunnel"] = {"port": port, "postgres_service_instance_id": evidence["postgres_service_instance_id"], "database": "where2meet_import"}
        arguments, destination = ssh_arguments(evidence["postgres_service_instance_id"])
        tunnel = start_owned(run, state, "database-tunnel", [*arguments, "-N", "-o", "ExitOnForwardFailure=yes", "-L", f"127.0.0.1:{port}:127.0.0.1:5432", destination], HELPERS, ppe.private_environment())
        def connected():
            require(tunnel.poll() is None, "SSH tunnel exited; private output withheld")
            with socket.socket() as connection:
                return connection.connect_ex(("127.0.0.1", port)) == 0
        control.wait_for(connected, "owned PostgreSQL tunnel", timeout=30)
        require_owned_tunnel(state)
        database_url = tunnel_url(variables["DATABASE_URL"], port)
        frontend_env = {**env, "NODE_ENV": "development", "BACKEND_URL": state["backend_url"], "NEXT_PUBLIC_BACKEND_URL": state["backend_url"],
            "NEXT_PUBLIC_API_URL": state["backend_url"], "NEXT_PUBLIC_APP_URL": ppe.CLIENT_ORIGIN, "NEXT_PUBLIC_MOCK_MODE": "off", "MOCK_MODE": "off",
            "NEXT_PUBLIC_MOCK_DOMAINS": "", "MOCK_DOMAINS": "", "NEXT_PUBLIC_USE_MOCK_API": "false", "NEXT_PUBLIC_GA_MEASUREMENT_ID": "",
            "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": os.environ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]}
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 4317))
        start_owned(run, state, "frontend", ["node", "node_modules/next/dist/bin/next", "dev", "-p", "4317", "-H", "127.0.0.1"], runtime / "app/client", frontend_env)
        def frontend_ready():
            try:
                return ppe.http(ppe.CLIENT_ORIGIN)[0] == 200
            except RuntimeError:
                return False
        control.wait_for(frontend_ready, "fixed import frontend", timeout=180)
        state["status"] = "ready"
        save(run, state)
        inspect(run)
        proof = start_owned(run, state, "proof", ["node", str(HELPERS / "migration-proof.mjs"), str(run), state["fixture_dir"], "--profile", "populated-v1"], HELPERS,
                            {**ppe.private_environment(), "DATABASE_URL": database_url})
        require(proof.wait(timeout=1800) == 0, "Populated remote proof failed; inspect sanitized evidence")
        result = json.loads((run / "evidence/migration-result.json").read_text())
        require(result["status"] == "PASS" and result.get("cleanup") == {"runtime": True, "private_bundle": True} and
                json.loads((run / "evidence/resource-cleanup.json").read_text())["status"] == "PASS", "Remote populated proof or cleanup did not pass")
        return result
    except BaseException:
        control.write_json(run / "evidence/remote-controller-failure.json", {"status": "FAIL", "error": "Remote controller did not complete; private details withheld"})
        cleanup(run)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("verify", "cleanup", "_doctor", "_restart", "_clock", "_dispose", "hold-import-cleanup"))
    for name in ("run", "owner", "target", "fixture", "repo", "frontend-repo"):
        parser.add_argument("--" + name, type=Path, required=name == "run")
    args = parser.parse_args()
    run = args.run.resolve()
    if args.operation in ("verify", "cleanup"):
        run.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(run / "remote-controller.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            details = os.fstat(descriptor)
            require(stat.S_ISREG(details.st_mode) and details.st_uid == os.getuid() and details.st_nlink == 1 and stat.S_IMODE(details.st_mode) == 0o600, "Remote controller lock ownership changed")
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = verify(args) if args.operation == "verify" else cleanup(run)
        finally:
            os.close(descriptor)
    else:
        state = read_run(run)
        require(caller_is_proof(state), "Internal import operation requires its recorded live proof process")
        if args.operation == "hold-import-cleanup":
            control.hold_cleanup_lock(run)
            return
        if args.operation == "_doctor":
            result = inspect(run)[0]
        elif args.operation == "_restart":
            result = restart(run)
        elif args.operation == "_clock":
            result = backend_clock(run)
        else:
            result = dispose(run)
    print(json.dumps(result))


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except BaseException:
        print(json.dumps({"status": "FAIL", "error": "Remote import operation failed; provider, credential and row details withheld"}), file=sys.stderr)
        sys.exit(1)
