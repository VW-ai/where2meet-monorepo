#!/usr/bin/env python3
"""Fail closed on incomplete CI workloads or browser verification evidence."""

import argparse
import json
import os
from pathlib import Path
import re
import sys


REQUIRED_JOBS = ("lint", "build", "test", "client", "browser-compat", "workflow-lint")
STAGING_JOB = "staging"
NON_PR_EVENTS = {"push", "merge_group", "workflow_dispatch"}
RESULTS = {"success", "failure", "cancelled", "skipped"}


def gate(needs_json, event_name):
    needs = json.loads(needs_json)
    if not isinstance(needs, dict):
        raise ValueError("needs must be an object")
    if event_name not in NON_PR_EVENTS | {"pull_request"}:
        raise ValueError("unsupported CI event")
    rows = []
    for name in (*REQUIRED_JOBS, STAGING_JOB):
        job = needs.get(name)
        result = job.get("result") if isinstance(job, dict) else None
        outcome = result if isinstance(result, str) and result in RESULTS else "invalid"
        if name not in needs:
            outcome = "missing"
        rows.append((name, outcome))
    passed = (set(needs) == set((*REQUIRED_JOBS, STAGING_JOB))
              and all(outcome == "success" for name, outcome in rows if name != STAGING_JOB)
              and rows[-1][1] == ("success" if event_name == "pull_request" else "skipped"))
    lines = ["| Workload | Result |", "| --- | --- |"]
    lines.extend(f"| {name} | {outcome} |" for name, outcome in rows)
    if set(needs) - set((*REQUIRED_JOBS, STAGING_JOB)):
        lines.append("Unexpected workload keys present.")
    return passed, lines


def evidence(directory, backend_sha, frontend_sha, scenario):
    if any(re.fullmatch(r"[0-9a-f]{40}", sha) is None for sha in (backend_sha, frontend_sha)):
        raise ValueError("expected identities must be full commit SHAs")
    documents = {}
    for name in ("doctor", "result", "cleanup"):
        path = directory / f"{name}.json"
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise ValueError(f"{name}.json is missing or malformed") from error
        if not isinstance(document, dict):
            raise ValueError(f"{name}.json must be an object")
        documents[name] = document
    expected = {
        "doctor": {
            "status": "PASS", "source_commit": backend_sha, "frontend_commit": frontend_sha,
            "source_status": "", "frontend_status": "", "mocks": "off",
            "process_ownership": "verified", "schema_mode": "migrations", "backend_mode": "compiled",
        },
        "result": {"status": "PASS", "source_commit": backend_sha, "frontend_commit": frontend_sha,
                   "backend_mode": "compiled", "feature": scenario},
        "cleanup": {"status": "cleaned", "issues": []},
    }
    for name, fields in expected.items():
        for key, value in fields.items():
            if documents[name].get(key) != value:
                raise ValueError(f"{name}.json has invalid {key}")
    return True, [f"Backend commit `{backend_sha}`.", f"Frontend commit `{frontend_sha}`.",
                  "Browser evidence matches both commits and cleanup completed."]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    operations = parser.add_subparsers(dest="operation", required=True)
    gate_parser = operations.add_parser("gate")
    gate_parser.add_argument("--needs-json", required=True)
    gate_parser.add_argument("--event-name", required=True)
    evidence_parser = operations.add_parser("evidence")
    evidence_parser.add_argument("--evidence-dir", type=Path, required=True)
    evidence_parser.add_argument("--backend-sha", required=True)
    evidence_parser.add_argument("--frontend-sha", required=True)
    evidence_parser.add_argument("--scenario", choices=("event-lifecycle", "accounts"), default="event-lifecycle")
    args = parser.parse_args()
    try:
        if args.operation == "gate":
            passed, lines = gate(args.needs_json, args.event_name)
        else:
            passed, lines = evidence(args.evidence_dir, args.backend_sha, args.frontend_sha, args.scenario)
    except (OSError, ValueError) as error:
        passed, lines = False, [str(error) if args.operation == "evidence" else "Malformed needs JSON."]
    report = "\n".join([f"CI {args.operation}: {'PASS' if passed else 'FAIL'}", "", *lines]) + "\n"
    print(report, end="")
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(report)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
