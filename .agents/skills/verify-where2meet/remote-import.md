# Isolated Railway import rehearsal

Use this recipe only for the populated synthetic fixture described in [migration.md](migration.md). It runs the same importer, credential checks and anonymous browser assertions against a fresh, independently owned backend, PostgreSQL 17 and Redis trio in the authorized Railway PPE environment. It never imports into the existing PPE services. Source coverage and unit tests are not a live acceptance result.

Freeze the helper checkout before creating a new legacy bundle. Pin clean backend and frontend checkouts separately. The controller copies their source, installs locked dependencies and starts the fixed frontend at `http://127.0.0.1:4317`. Keep this port free. Prerequisites include the local recipe's tools, Railway CLI, native OpenSSH, the registered temporary SSH identity and a verified known-hosts file. Supply `PPE_SSH_KEY`, `PPE_SSH_KNOWN_HOSTS` and the real `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` through the caller's environment. The backend's Google key must already be configured by the resource setup owner. Do not put credentials in arguments, manifests or ordinary evidence.

Confirm that the setup operator can delete services and volumes before creating the trio. Railway lists both operations under the Admin role in its [workspace permissions](https://docs.railway.com/projects/workspaces). An identity that can create or deploy services may still be unable to remove them.

The setup owner supplies an accepted `where2meet-m5-resource-owner-v1` journal and a `where2meet-ppe-target-v1` manifest. The journal must stay in its original setup directory. It records the planned names before creation, exact returned service and PostgreSQL volume IDs, confirmed creation actions, successful deployments, source upload identity and backend image digest. The verifier copies this journal and creates one exclusive `import-consumer.json` beside the original. Treat the accepted setup journal as operator authorization. Do not construct or edit one to bypass a refusal.

```sh
REMOTE_RUN="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-remote-import.XXXXXX")"
python3 "$VERIFY_SKILL/helpers/ppe_import.py" verify \
  --run "$REMOTE_RUN" \
  --owner "$SETUP_DIRECTORY/ownership.json" \
  --target "$SETUP_DIRECTORY/target.json" \
  --repo "$CANDIDATE_REPO" \
  --frontend-repo "$FRONTEND_REPO" \
  --fixture "$PRIVATE_FIXTURE_DIR"
```

Create `PRIVATE_FIXTURE_DIR` first with the frozen `legacy-fixture.mjs --profile populated-v1` recipe. The legacy source must be stopped and its complete snapshot validated. The remote proof requires empty business tables, imports twice before authentication, compares every row and field, then consumes only the known expired session. It verifies all old tokens and account relationships before and after one backend restart. A lost importer reply fails the proof. It never resumes or replays that import.

`RemoteImportRun` keeps the database URL in memory and child environment only. The controller resolves the selected PostgreSQL service, opens a strictly loopback native SSH tunnel and verifies its PID, start identity and listening address. A fixed database query must return `where2meet_import`, PostgreSQL major 17 and server port 5432. Importer and Chromium environments exclude Railway credentials and SSH key paths. The existing local candidate still requires its own local database receipt.

Fresh PPE identity checks bracket imports, authentication, restart and browser work. Restart requires unchanged deployment, image and database identity plus a changed actual PID 1 identity observed through SSH. Railway's replica ID alone is insufficient. The browser guard permits reads of the two imported events, their votes, the one shared Venue and its photo, and the anonymous local session proxy. Every application redirect is refused except that exact photo endpoint's validated, credential-free Google image redirect. There are no anonymous SSE allowances or browser writes.

The final Venue refresh must match one observed details response. Two backend-clock observations bracket the browser phase. Each has a measured round trip of at most ten seconds; their offset intervals must overlap. This supplies the timestamp bounds without assuming the workstation and backend clocks agree. All other rows and fields remain exact after the known expired session is removed.

## Disposal and recovery

After resource ownership is claimed, success and failure both attempt disposal of the exact owned services and PostgreSQL volume. If launch fails before the Node proof claims the private bundle, that bundle remains caller-owned and must be removed separately after resource cleanup. The verifier never runs row cleanup or deletes a shared Venue. It stops only its recorded frontend and tunnel process groups, deletes the new backend first, then Redis and PostgreSQL, and inspects for the exact volume even if service deletion detached it. Pending deletion is not absence. Cleanup must prove all three service IDs and the volume ID absent while the accepted PPE services retain their recorded metadata. Only then may it remove the private fixture and local runtime.

The result remains failed if proof failed, even when disposal succeeds. Retain `run.json`, the copied resource owner, import ownership receipts and `evidence/`. Evidence includes `migration-result.json`, `identity-checks.jsonl`, `backend-restart.json`, `resource-cleanup.json`, both browser captures, observed Venue response projections and clock observations. It excludes database URLs, credential values, private key paths and provider error bodies.

After an interrupted controller exits, use its original run directory:

```sh
python3 "$VERIFY_SKILL/helpers/ppe_import.py" cleanup --run "$REMOTE_RUN"
```

Cleanup verifies the frozen resource receipt and exclusive consumer before mutation. It stops a still-owned proof process, invokes the existing cleanup-only bundle path if an import receipt exists, and never imports. Kernel locks reject an active controller or cleanup owner and release on process death. If a durable run exists but the external consumer write was interrupted, recovery may reconstruct that exact exclusive receipt after proving the original controller inactive. A different consumer is refused. An interruption before durable `run.json` remains setup-owner cleanup; automatic run recovery is not claimed for that boundary.

Do not launch another verify command for the same trio or bundle. After failure, use cleanup only, then create a fresh trio and fixture for another proof. If process identity, resource ownership or absence cannot be established, retain all receipts for the setup owner to inspect. Temporary SSH key revocation is a separate root-owned step. Final acceptance requires its key-absence receipt as well as proof and disposal PASS.

This rehearsal does not establish historical-data compatibility, production cutover, large-pack performance, production database version parity, hosted frontend behavior or completed map rendering.
