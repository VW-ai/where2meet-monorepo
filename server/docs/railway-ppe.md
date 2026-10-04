# Railway PPE rehearsal

This branch is an incomplete replacement backend. PPE validates the first meeting lifecycle only. Do not route production traffic to it. Keep PR #17 and this branch unmerged until the planned PPE review.

## Existing deployment triggers

The checked-in production workflow only deploys after a manual request with `confirm=deploy`. Staging also deploys after a successful Server CI run caused by a push to `main`. Pull request CI, including a pull request targeting another development branch, does not satisfy that staging condition.

Railway can have a separate GitHub deployment integration. Before uploading this branch, inspect the target service's linked repository, branch, automatic deployment setting, and root directory in Railway. The repository workflows do not prove those dashboard settings.

## Prepare the isolated environment

1. Use a dedicated Railway environment named `ppe`, with its own backend service, PostgreSQL database, and Redis instance. Confirm that its database and Redis references point to PPE resources. Do not copy production connection strings.
2. Select the reviewed commit of `codex/m1-meeting-lifecycle`. Set the backend service root directory to `server`. The checked-in Dockerfile builds Node.js 20, and `railway.toml` runs database migrations before starting the compiled application.
3. Set `DATABASE_URL`, `REDIS_URL`, `NODE_ENV=production`, `HOST=0.0.0.0`, and `CORS_ORIGINS` for the PPE frontend origin. Railway supplies `PORT`. The first lifecycle requires no server Google key. Use an appropriately restricted browser key only if maps are included in a later acceptance pass.
4. Deploy a separate frontend preview at the exact frontend revision recorded in the acceptance report. Set `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, and `NEXT_PUBLIC_API_URL` to the PPE backend origin. Set `NEXT_PUBLIC_APP_URL` to the preview origin. Disable all mock flags. These public values must be present when the frontend builds.
5. Confirm `/health/ready` reports both database and Redis ready. Record the commit, image/build output, database version, Redis version, frontend URL, and backend URL. Keep secret values out of the report.

The deployment workflows for `staging` and `production` are not PPE deployment tools. They sync environment-specific settings and must not be repurposed by passing a different branch. No PPE deployment was triggered while preparing this branch.

## Acceptance

The shipped launcher and browser driver operate only on owned local runs. They cannot be pointed at Railway. Run this manual browser recipe against the PPE preview and save screenshots plus credential-free request metadata:

1. Fill `Occasion` and `Your name`, choose a date and time, leave the optional address empty, and click `Create Meeting`. Require HTTP 201 and the expected meeting title and organizer name.
2. Reload the meeting. Require a successful `/me` request and the organizer `Settings` button. In a separate recovery check, remove only that event's cached participant ID, retain its existing token, and reload. Require the same organizer ID to be restored. Do not record the token value.
3. Use `Settings`, `Edit Event`, and `Save Changes` to change the title. Reload and check that it persists.
4. Open the share URL in a fresh browser session. Require the changed title and no organizer `Settings` button.
5. In the organizer browser, select `Delete Event`, enter `DELETE`, and confirm. Require a return to the landing page and a 404 response from the deleted event URL.

Corroborate mutations with read-only queries against the independently confirmed PPE database. Check the browser's request destinations. Every meeting API request must go to the PPE backend. This remote recipe remains unverified until the PPE run; local evidence does not count as a Railway result.

Import a synthetic fixture created by the old backend into the independent PPE database. Preserve original event IDs, participant IDs, credential hashes, password hashes, relationships, timestamps, and session expiration. Compare imported rows before testing authentication. Import the same file twice to prove that retries do not change data, then restart the service and verify the old participant token and old valid session cookie. The deliberately expired test session must remain unauthorized.

Run the importer from a checkout with development dependencies installed, using `npm --prefix server run import:data -- /private/path/rows.json` and the confirmed PPE `DATABASE_URL` supplied through the environment. The production Docker image does not include this TypeScript import tool. Remote restart and credential checks require separate PPE orchestration; the local `migration-proof.mjs` helper is not a remote test runner.

Fixture files and plaintext test credentials stay private and outside the repository. The importer is a rehearsal tool, not evidence that historical production data has already been audited. Real migration still requires an export audit, rehearsal, and write cutoff plan.

The current backend supports meeting creation/read, participant identity, name updates, event edits/deletion, vote reads, session reads, and authenticated SSE. Participant location/join, account writes, venue search, routing, voting writes, and publication are not implemented in this batch. They must return an explicit unavailable response. Do not count those paths as passed or production ready.

## Stop and retry

On a failed PPE check, keep production and staging on their existing versions. Preserve the PPE evidence and database for diagnosis. Retry on the isolated environment with the fixed commit. Deleting or replacing a PPE fixture is a separate explicit action; do not reset an environment whose ownership has not been confirmed.
