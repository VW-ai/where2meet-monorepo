# Recorded verification coverage

## M2 accounts and meeting claims, 2026-10-04

The account backend at `2c9d892f6fdca2eff8b2a843146f6cdcf0add678` passes 88 server tests, static checks and compilation. Client revision `4eb4badb6596e88828f7917d2d6b71688de59e56` passes 94 tests and type checks, with zero lint errors and 52 existing warnings. Registration, login, logout, profile updates, dashboard reads and meeting claims now have implemented operations. Places search, routing, vote writes and publication remain unimplemented.

The final local account flow passes all 18 checks with the clean frontend `137a408cba37303ad950fede552e113199c99b55`. This local verification commit combines the account frontend with current main `9cde2f7619fe2c74328f7aefc3c63412a04e177d`; it does not merge a pull request. That composition also passes type checking and all 130 client tests. The run is `2026-10-04-m2-accounts-local-final`. It proves anonymous organizer registration and claim, retained meeting credentials and SSE, signed-in creation, profile persistence, independent sessions and the separate-device public-view limit. Its `result.json` lists exclusions.

The clean unchanged frontend `05e6daa2245e31dfd142768b545b74cdb9a51476` also passes seven synthetic legacy import and restart checks against this backend. The run is `2026-10-04-m2-accounts-import-final`. The original password, participant token, relationship ID and timestamps survive import and restart. The expired session stays unauthorized, and logging out a new session leaves the original valid session intact. This is not a historical production export or cutover rehearsal.

Independent review reproduced a cancelled profile save that stayed busy after failed logout. The fixed Settings component restores its save button, shows the failure and retains the valid account. The component fault test substitutes transport and Google/Next rendering dependencies; it does not establish backend or PPE behavior. Real browser and database evidence remains separate.

The account backend is deployed to dedicated PPE deployment `f6042b7d-01b5-41df-b82d-86e728dc30a2`. Control-plane identity and database/Redis readiness pass. The remote account scenario remains unverified pending temporary SSH access for database corroboration and bounded cleanup. No account test data has been created in PPE for this slice. Local PASS and deployment readiness do not satisfy remote acceptance. No migration PR is merged, and staging and production are unchanged.

## Railway PPE, 2026-10-04

PASS for the M1 no-location lifecycle against deployment `c49fa4e7-f179-42fd-9103-9586e6b2d486`, backend source `9850114`, and clean local frontend `05e6daa`. The final fixed-verifier run is `2026-10-04-ppe-d`. It verified UI creation, organizer identity and token-only recovery, title editing, anonymous sharing, and deletion with read-only remote database corroboration. Public HTTP checks covered missing/invalid credentials, invalid title edits with unchanged state, empty vote reads and unauthorized sessions. The authenticated stream supplied a heartbeat and the title-update notice. Cleanup removed the synthetic event and local processes.

[Hosted browser CI](https://github.com/VW-ai/where2meet-monorepo/actions/runs/37243295396) passed on Linux with verifier revision `3516fa5`. All 16 boundary and listener tests passed without skips, followed by the complete local browser lifecycle and successful cleanup. Server CI also passed the 21 backend tests, type and module checks, lint, formatting, and Docker image build. Remote PPE acceptance remains an explicit separate run.

See [the complete PPE record](../../../server/docs/ppe-verification-2026-10-04.md) for identities, evidence files, earlier attempts and limitations. Node.js 20.20.2, PostgreSQL 18.6 and Redis 8.2.10 ran in PPE; Next ran locally in development mode with mocks off. Existing production PostgreSQL uses version 17, so this is not version-parity or database-upgrade proof. Google behavior, unimplemented operations, historical import and production frontend hosting remain unverified for PPE.

The deployment and browser evidence supersede the PPE-unverified status in the earlier local report below. No migration PR was merged and staging/production were not deployed by this setup.

## M1 replacement backend, 2026-10-04

Backend revision `a60984a9c93c179e27877174d322d85fae94185c` ran with the clean, fixed frontend `05e6daa2245e31dfd142768b545b74cdb9a51476`. Local runtime versions were Node.js 24.19.0, PostgreSQL 14.17, and Redis 8.2.3. The backend ran its compiled entrypoint after all six checked-in migrations initialized an empty, owned database. The frontend ran in development mode with mocks off.

| Run | Observed result | Evidence files |
| --- | --- | --- |
| Candidate C, no-location lifecycle | PASS. Create, organizer name, reload, recovery with only the original token, title edit, anonymous share view, and delete. API and stored rows corroborate the browser actions. | `2026-10-04-m1-candidate-c/evidence/result.json`, `actions.json`, `created-state.json`, `edited-state.json`, `deleted-state.json` |
| Candidate D, final driver | PASS. Repeat the same lifecycle with the reviewed driver, deriving the created event ID from its share URL after checking HTTP 201. This avoids reading a discarded response body after navigation. | `2026-10-04-m1-candidate-d/evidence/result.json`, `actions.json` |
| Candidate C, old-data import and restart | PASS. Preserve every exported field, retry without changes, accept old participant and valid session credentials, reject the deliberately expired session, repeat after restart, and open the original share link. | `2026-10-04-m1-candidate-c/evidence/migration-result.json`, `backend-restart.json`, `imported-share-link.png` |
| Fixed frontend against old backend `5a158d8` | FAIL overall, with 15 of 16 account checks passing. Token-only `/me` recovery now passes. Anonymous organizer auto-claim still fails. | `2026-10-04-m1-accounts-oldbackend/evidence/accounts-result.json`, `accounts-token-only-identity-recovery.json` |

The private import sample came from real create/register/login/claim requests to an isolated old backend. It contains one event, participant, user, identity, and account link, plus two sessions. One session was deliberately expired in that owned database. The old backend was stopped before candidate checks. Venue and Vote are empty in this sample; all eight model shapes, including populated votes and venues, have separate database integration tests. This is not a production export or historical-data audit.

Server validation passed 21 tests, type checking, lint, formatting, module ownership checks, and compilation. The tests use real PostgreSQL transactions and Redis, and include import rollback/retry, permissions, stored votes, session expiration, SSE, degraded notifications, and negative architecture examples. Client validation passed 73 tests, type checking, and a production build; lint had zero errors and 52 existing warnings. The frontend build used the repository CI configuration, separate from the real-backend browser runs. Logs are in `2026-10-04-m1-checks/`.

The first candidate's credential check had a fetch transport failure after restart despite a healthy restarted service. Later diagnostic requests did not reproduce it. The driver now opens fresh HTTP connections for restart checks; candidate B and C passed. Candidate B's lifecycle attempt lost its form title before submission during page initialization. The driver now waits for the initial session response and verifies inputs before submitting; candidate C passed. Failed evidence remains retained.

M1 does **not** implement location/join, account writes, venue search/details, routes, vote writes, or publication. Those operations return 501. M0 Google results below do not verify this new backend. Password hashes are preserved, but new login is not implemented. Lost SSE broadcasts remain best effort, without replay.

Railway PPE, the Node.js 20 Docker image, production frontend serving, and production cutover remain unverified. The local Docker engine was not running. The new CI includes an image build and browser compatibility job, but those remote results are not part of this local report. Follow [the PPE recipe](../../../server/docs/railway-ppe.md) before accepting a Railway deployment. No merge or deployment was performed.

## Historical M0 baseline

Original frontend and backend: `8f8535a17109b6e71f2106361d6685a5641d980e`.
Compatible frontend: `d7a8bcd9238b9e20260f091c41e3de5e822da2ac`. Its server tree is unchanged from the original. This is a verified candidate for the listed paths, not approval to migrate or deploy.

All browser runs used disposable local PostgreSQL and Redis, fresh Chrome contexts, mocks off, and synthetic application data. The Google flow used Doppler project `where2meet`, config `dev`, secret name `GOOGLE_MAP`. No production database was used.

| Run | Observed result | Evidence files |
| --- | --- | --- |
| Original Google flow, 2026-10-03 | FAIL. Last-vote removal left the guest at 1; unpublish left the guest locked. | `2026-10-03-google-e/evidence/google-result.json` |
| Compatible Google flow, 2026-10-04 | PASS. Map, autocomplete and geocoding, two participants, search/details, two driving routes, two walking routes, add/remove final vote, publish/reload/unpublish. Existing guest updates without reload. | `2026-10-04-m0-sync/evidence/google-result.json`, `google-actions.json`, `google-sse-messages.json`, `google-08-reopened-guest.png` |
| Compatible no-location lifecycle | PASS. Create, organizer name, cached organizer controls after reload, title edit, anonymous view, delete. | `2026-10-04-m0-sync/evidence/result.json` |
| Original account flow, 2026-10-04 | FAIL overall. 14 of 16 checks pass; two product failures remain asserted. No terminal script error in the final run. | `2026-10-04-m0-accounts-e/evidence/accounts-result.json` |

Evidence is retained locally under `/Users/waynewang/Documents/ChatGPT/where2meet/verification-evidence/`. Runtime directories were cleaned. Raw browser traces, credentials and evidence databases are not checked in. Rerun the shipped helpers to reproduce the assertions.

### M0 account results

Passed protected-route redirects, anonymous creation, cached organizer controls after reload, registration with a server session, signed-in creation with a persisted organizer claim, dashboard reload, name and fuzzy preference persistence, canceling unsaved settings, logout with session invalidation, signing in again, separate-browser anonymity, separate-browser sign-in and claimed dashboard card, opening that card, and no uncaught browser errors.

The M0 run recorded two acceptance failures. M1 resolves the first through the frontend correction above; the second remains open:

- `/me` returns `participantId`; the page reads `id` and observes no participant ID. Existing local credentials still restore the organizer controls. Evidence: `accounts-me-identity-observation.json`.
- Registering after anonymous organizer creation does not claim that event. No successful claim request was observed, and the database has no account link. Creating while signed in uses a separate claim path and passes. Evidence: `accounts-anonymous-claim-state.json`, `accounts-signed-in-creation-state.json`.

A separate signed-in browser lists the organizer card but opens the event with guest controls. Account claims currently do not restore participant Bearer credentials on another browser. This is a recorded limit, not a tested permission upgrade. Evidence: `accounts-separate-event-access.json`.

Cookie metadata and database checks record attributes, original expiration timestamps, identity providers, IDs and hash presence. They do not retain passwords, Cookie values, or hash values. This is not an old-data import or expired-session migration proof.

Earlier account runs a-d contain a response-envelope mistake and navigation-related response-body capture failures in the draft driver. They are preserved as failed attempts. The final driver verifies the UI and corroborates state with read-only requests sharing the browser session.

### M0 automated checks

The initial five regression tests reported `Tests 3 failed | 2 passed (5)`. After the fix, eight SSE tests and all 59 client tests passed. TypeScript checking passed. ESLint had zero errors and 54 existing console warnings. The production bundle built with the repository CI configuration; that mock-enabled build is separate from the real-backend browser proof.

The fix accepts empty vote snapshots, reads canonical voterIds, and applies nested event fields including null publication values. Real messages captured in the Google run match these formats. Voting rules did not change.

Still unverified: other recipe variants, participant claims, phone layouts, privacy, transit/cycling, exact-place entry, default addresses and applying account location preferences, map/statistics controls, detail-heart publication guards, historical-data import, production serving and deployment. Stream chunk parsing, concurrent snapshot freshness and recovery after a lost best-effort broadcast remain separate work. Do not mark these passed from this baseline.
