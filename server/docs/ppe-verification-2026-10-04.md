# PPE verification, 2026-10-04

The fixed local frontend passed the M1 meeting lifecycle against the deployed Railway PPE backend. The run also checked public HTTP rejection behavior, stored state, and authenticated SSE. This is M1 acceptance only. The replacement backend remains incomplete, and the migration PRs remain unmerged.

## Deployed target

The [target manifest](ppe-target.json) identifies the exact project, environment, services, backend source, frontend revision, and input archive. The backend origin is `https://ppe-backend-ppe.up.railway.app`; the local frontend used `http://127.0.0.1:4317` with mocks off.

- Backend source: `985011495ad98a4bfecbcf6eb8a97fc93d550955`.
- Fixed frontend: `05e6daa2245e31dfd142768b545b74cdb9a51476`.
- Backend deployment: `c49fa4e7-f179-42fd-9103-9586e6b2d486`.
- Image digest: `sha256:a04b384cb9350ff471d2d6c470b08d532c644a4866217e88729c61968db6f93a`.
- Running versions: Node.js 20.20.2, PostgreSQL 18.6, Redis 8.2.10. All six checked-in migrations applied successfully to the new database.
- Frontend mode: local Next development server, fresh Chrome contexts, no Google key.

The backend source came from a clean Git archive. Its recorded SHA-256 describes that input archive; Railway CLI repackages the extracted directory. The verifier checks the deployment identity and setup-provided source revision, not running binary contents. Pre/post control-plane checks detect deployment drift without atomically pinning HTTP requests. PPE has no GitHub source connection or automatic deployment trigger, and one operator owned deployment during the run.

## Browser and domain boundary results

The final run is `2026-10-04-ppe-c` under the local `verification-evidence/` directory. `result.json` is PASS and `cleanup.json` is cleaned. The verifier checked that its source fingerprint did not change during the proof.

| Operation | Observed result | Evidence in `evidence/` |
| --- | --- | --- |
| Create without a location | UI returned 201; organizer name, event and participant persisted | `created-state.json`, `02-created.png` |
| Reload and token-only recovery | `/me` restored the same organizer identity and Settings | `actions.json`, `03b-token-only-recovery.png` |
| Edit title | UI returned 200; API, database and anonymous share view matched | `edited-state.json`, `05-shared-view.png` |
| Missing credential | Identity, edit and delete returned 401; event stayed unchanged | `ppe-http-checks.json` |
| Invalid credential | Identity, edit and delete returned 403; event stayed unchanged | `ppe-http-checks.json` |
| Empty or overlong title | Edit returned 400; API and stored state stayed unchanged | `ppe-http-checks.json` |
| Read empty votes | Returned an empty venue list and totalVotes 0 | `ppe-http-checks.json` |
| Anonymous or unknown session | Returned 401 | `ppe-http-checks.json` |
| Authenticated SSE | Received a heartbeat and the event update for the UI title edit | `ppe-sse.json` |
| Delete | UI returned 200, share URL returned 404, event and participant rows were absent | `deleted-state.json`, `07-deleted.png` |
| Target and cleanup | Recorded PPE identity; no blocked API requests; no owned event remained | `doctor.json`, `identity-checks.jsonl`, `ppe-request-guards.json`, `cleanup.json` |

Database corroboration used fixed projections inside read-only transactions over authenticated SSH. Evidence contains credential-presence booleans, not tokens, cookies, passwords, connection strings, or credential hashes. No database public TCP proxy was created. The SQL role's broader write privileges were not tested or claimed.

The first setup attempt, `ppe-a`, failed during the local frontend startup wait before creating an event. The readiness retry was corrected. `ppe-b` passed its browser assertions and cleanup, but verifier code changed during that run, so it is superseded by the fixed-verifier run C. The failed and superseded evidence remains available.

The separate `ppe-recovery` run deliberately used an unavailable local SSH identity. It created its own event through the UI, then failed database corroboration. The driver retained a FAIL result and the exact pending event ID. After restoring the valid identity, `cleanup` confirmed deletion and returned `cleaned` with no remaining IDs. `initial-cleanup.json` preserves the incomplete result; the original failed `result.json` remains FAIL after recovery. This exercises failure recovery without changing the backend or any unrelated event.

## Persistent checks

The verification helper has 11 credential-free boundary and ownership tests. They reject wrong environments, source/target inconsistencies, deployment or resource drift, unowned mutations, and secret-bearing manifests. CI runs these tests before the existing local browser compatibility flow. Domain behavior continues to use the existing real PostgreSQL HTTP integration tests. Invalid-create rejection stays in disposable local tests; the remote driver exercises invalid edits against an owned UI-created event.

The backend browser workflow previously failed before scheduling a job because job-level `env` used the unavailable `runner` context. Its first step now writes the runner directory to `GITHUB_ENV`. A separate workflow runs actionlint, ShellCheck, and Pyflakes so an invalid browser workflow can still receive a failing check. All seven workflow files passed local validation with these integrations enabled.

## Limits

This proof excludes Google Maps, location/join, routing, vote writes, publication, account writes, valid/expired imported sessions, historical-data import, production frontend hosting, and production cutover. The missing M2+ operations remain unavailable. Cross-event authorization has local HTTP test coverage but was not separately exercised in this PPE browser run.

Railway's current PostgreSQL template selected version 18, while the existing staging and production services use version 17 images. This run does not prove PostgreSQL major-version parity or a database upgrade. Align versions or rehearse the upgrade before production migration.

CI runs local compatibility and tool guard checks. Remote PPE evidence remains an explicit acceptance step. Automated staging verification and production promotion are future pipeline work.
