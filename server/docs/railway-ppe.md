# Railway PPE rehearsal

This branch is an incomplete replacement backend. PPE validates the first meeting lifecycle only. Keep the migration PRs unmerged until the user requests a merge. [The verification skill](../../.agents/skills/verify-where2meet/ppe.md) runs the fixed local frontend against PPE and records browser, HTTP, and database evidence.

## Current PPE

Project `where2meet-server` belongs to `Victor Zhang's Projects`. The dedicated environment contains independent backend, PostgreSQL, and Redis service instances. No production data was copied.

| Resource | ID |
| --- | --- |
| Project | `848dc1e0-d9c2-4571-b542-73a1efdc5848` |
| PPE environment | `b4f01e02-40e8-406d-94a7-3797b3db4eea` |
| `ppe-backend` | `27346658-ce2f-4da5-a999-7c4cb549f9a0` |
| `ppe-postgres` | `d1eaf58e-bcdf-4717-8a67-33874c907739` |
| `ppe-redis` | `6e5789ef-1f5d-4084-bcf4-24bb8591f94d` |

The backend origin is `https://ppe-backend-ppe.up.railway.app`. The local frontend origin is `http://127.0.0.1:4317`. Both `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL` point to PPE; `NEXT_PUBLIC_MOCK_MODE=off`. The verifier sets these values in a fresh frontend copy, so no hosted-frontend permission is needed.

[ppe-target.json](ppe-target.json) records the initial deployment and revisions. Obtain fresh Railway metadata before each run. Its revision variable and source archive are deployment provenance supplied by the deployer, not an independent attestation of running code.

## Existing deployment triggers

The checked-in production workflow only deploys after a manual request with `confirm=deploy`. Staging also deploys after a successful Server CI run caused by a push to `main`. Pull request CI, including a pull request targeting another development branch, does not satisfy that staging condition.

Railway can have a separate GitHub deployment integration. Before uploading this branch, inspect the target service's linked repository, branch, automatic deployment setting, and root directory in Railway. The repository workflows do not prove those dashboard settings.

## Prepare the isolated environment

1. Use a dedicated Railway environment named `ppe`, with its own backend service, PostgreSQL database, and Redis instance. Confirm that its database and Redis references point to PPE resources. Do not copy production connection strings.
2. Select a clean reviewed backend commit and archive it with `git archive`. Record the commit and SHA-256 of the input archive. The Railway CLI packages the extracted directory itself, so the archive digest is not the CLI upload-byte digest.
3. Set the backend root directory to `/server`, Dockerfile path to `Dockerfile`, start command to `/bin/sh -c "npx prisma migrate deploy && exec node dist/index.js"`, health path to `/health/ready`, and health timeout to 300 seconds. Inspect the effective deployment manifest after upload. The initial PPE deployment used the checked-in Dockerfile and all six schema migrations. Railway rejected setting a custom `railwayConfigFile` path as deprecated; the explicit service settings and detected repository file produced the intended effective deployment. Do not migrate the whole Railway project's configuration to fix that one setting. See [Railway's configuration migration guidance](https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code).
4. Set `DATABASE_URL=${{ppe-postgres.DATABASE_URL}}`, `REDIS_URL=${{ppe-redis.REDIS_URL}}`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, and `CORS_ORIGINS=http://127.0.0.1:4317,http://localhost:4317`. Set `PPE_SOURCE_REVISION` to the full uploaded revision. Do not put resolved secrets in files or command arguments. The M1 lifecycle requires no Google key.
5. Upload with explicit project, environment, and service IDs. Do not rely on a directory's default link. Keep the backend unconnected to a GitHub source so a verification run has one deployer and no automatic rollouts.
6. Confirm `/health/ready` reports both database and Redis ready, inspect the active deployment and domain, and record the image digest and runtime versions. Run the fixed local frontend with the verification skill. Keep secret values out of the report.

The deployment workflows for `staging` and `production` are not PPE deployment tools. They sync environment-specific settings and must not be repurposed by passing a different branch. The PPE setup uses explicit service-scoped CLI/API operations. It does not merge a PR or trigger those workflows.

## Acceptance

Use [the PPE verifier](../../.agents/skills/verify-where2meet/ppe.md) for this lifecycle. The ordinary `control.py` launcher remains local-only. The shared browser assertions exercise:

1. Fill `Occasion` and `Your name`, choose a date and time, leave the optional address empty, and click `Create Meeting`. Require HTTP 201 and the expected meeting title and organizer name.
2. Reload the meeting. Require a successful `/me` request and the organizer `Settings` button. In a separate recovery check, remove only that event's cached participant ID, retain its existing token, and reload. Require the same organizer ID to be restored. Do not record the token value.
3. Use `Settings`, `Edit Event`, and `Save Changes` to change the title. Reload and check that it persists.
4. Open the share URL in a fresh browser session. Require the changed title and no organizer `Settings` button.
5. In the organizer browser, select `Delete Event`, enter `DELETE`, and confirm. Require a return to the landing page and a 404 response from the deleted event URL.

Corroborate mutations with read-only queries against the independently confirmed PPE database through authenticated SSH. Check the browser's request destinations. Every meeting API request must go to the PPE backend. Require named passing results and cleanup evidence; local results do not count as Railway evidence.

The initial PPE runtimes are Node.js 20.20.2, PostgreSQL 18.6, and Redis 8.2.10. Railway's current PostgreSQL template selected version 18; the existing staging and production services use version 17 images. This PPE validates application behavior on its recorded versions. It does not establish PostgreSQL major-version parity or a production database upgrade. Align versions or rehearse that upgrade before a production migration.

## Later data-migration rehearsal

Import a synthetic fixture created by the old backend into the independent PPE database. Preserve original event IDs, participant IDs, credential hashes, password hashes, relationships, timestamps, and session expiration. Compare imported rows before testing authentication. Import the same file twice to prove that retries do not change data, then restart the service and verify the old participant token and old valid session cookie. The deliberately expired test session must remain unauthorized.

Run the importer from a checkout with development dependencies installed, using `npm --prefix server run import:data -- /private/path/rows.json` and the confirmed PPE `DATABASE_URL` supplied through the environment. The production Docker image does not include this TypeScript import tool. Remote restart and credential checks require separate PPE orchestration; the local `migration-proof.mjs` helper is not a remote test runner.

Fixture files and plaintext test credentials stay private and outside the repository. The importer is a rehearsal tool, not evidence that historical production data has already been audited. Real migration still requires an export audit, rehearsal, and write cutoff plan.

The current backend supports meeting creation/read, participant identity, name updates, event edits/deletion, vote reads, session reads, and authenticated SSE. Participant location/join, account writes, venue search, routing, voting writes, and publication are not implemented in this batch. They must return an explicit unavailable response. Do not count those paths as passed or production ready.

## Stop and retry

On a failed PPE check, keep production and staging on their existing versions. Preserve the PPE evidence and database for diagnosis. Retry on the isolated environment with the fixed commit. Deleting or replacing a PPE fixture is a separate explicit action; do not reset an environment whose ownership has not been confirmed.
