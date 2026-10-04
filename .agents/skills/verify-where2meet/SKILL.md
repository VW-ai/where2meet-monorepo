---
name: verify-where2meet
description: Verify Where2Meet browser behavior, persistence, and permissions locally or against an identified Railway PPE deployment. Use during feature development, regression investigation, and backend migration with a fixed frontend.
---

# Verify Where2Meet

Read [the feature map](features/README.md), then select the affected entries. The primary surface is the Next.js web UI. Fastify HTTP responses and read-only PostgreSQL queries corroborate browser actions. Existing Vitest tests do not replace these flows.

## Backend change acceptance

For backend behavior, persistence, or deployment changes, run the affected domain boundary tests and verify the deployed candidate in PPE. When the frontend is unchanged, keep its checkout fixed and clean. A local frontend connected to the identified PPE backend provides integration evidence without frontend hosting access. Follow [PPE verification](ppe.md); the local launcher below cannot target a remote database.

During exploration, turn each new or changed behavior into a repeatable boundary assertion. Call the public HTTP operation or domain operation and assert its result, stored state, and relevant failure behavior. For example, a rejected cross-event credential must leave the event unchanged. Do not substitute assertions about repository method calls for that outcome. Keep useful pure-rule tests where they catch separate errors; avoid duplicating every internal function with a test.

Run persistent assertions in CI. AI may discover a flow and improve its driver, but a release check uses fixed expectations and preserves failures. Record the frontend revision, backend source and deployment, exercised actions, boundary results, and cleanup evidence. A local PASS does not satisfy PPE acceptance. A PPE PASS covers only the listed behavior; production frontend hosting and historical-data migration need their own proof. This requirement does not authorize a production deployment or a merge.

## Local verification

This launcher targets the current Next.js and Fastify monorepo. [verification-status.md](verification-status.md) records the original and compatible frontend revisions. It copies the working tree, including local edits, into an isolated directory and excludes dependencies, generated output, and `.env*` files. Each run owns its database, Redis, ports, and fresh browser contexts.

## Launch

Prerequisites on PATH: Python 3, Node 20/22/24 LTS, npm, Git, `initdb`, `postgres`, `pg_isready`, `createdb`, `psql`, `redis-server`, `redis-cli`, and `lsof`. Google Chrome must be installed. The helper uses its own pinned Playwright dependency. It does not use an existing Chrome profile or install a browser.

Run from the monorepo root. Keep `VERIFY_RUN` for all commands in this run.

```sh
VERIFY_REPO="$(git rev-parse --show-toplevel)"
VERIFY_SKILL="$VERIFY_REPO/.agents/skills/verify-where2meet"
VERIFY_RUN="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-verify.XXXXXX")"
python3 "$VERIFY_SKILL/helpers/control.py" launch --repo "$VERIFY_REPO" --run "$VERIFY_RUN"
```

The launcher installs each application's locked dependencies, creates a private PostgreSQL cluster and Redis instance, generates Prisma, and applies the checked-in migrations with `prisma migrate deploy` to its empty owned database. It builds and starts the compiled Fastify entrypoint and Next's existing dev entrypoint with isolated ports. It then prints `RUN_DIR` and a doctor result. Require `status: PASS`, both dependencies `ok`, and an anonymous session response of 401. Read URLs and process identities from `run.json`; do not assume ports 3000/3001.

The default launch uses `--schema-mode migrations --backend-mode compiled`. Use `--schema-mode push --backend-mode source` only to reproduce the old baseline, and retain those mode labels in its evidence. A successful empty-database migration does not validate upgrading a populated production database or importing historical data. The launcher records actual Node, PostgreSQL, and Redis versions. Match production versions separately before migration acceptance.

Mock settings are explicitly off for both frontend routes and direct backend calls. Browser API, Next proxy, metadata lookup, and SSE use the same local backend. The launcher ignores ambient database URLs and application `.env` files. It forwards only the two explicitly supplied Google key variables, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY`. Without them, location, map, venue, route, and publication success remain unverified. The no-address activity lifecycle still runs against the real backend.

For this project, Doppler's `where2meet` project, `dev` config stores the Google key as `GOOGLE_MAP`. Inject only that secret and map it to the two application variables when launching. Do not export all Doppler secrets or copy production database settings into this run.

```sh
doppler run --project where2meet --config dev --only-secrets GOOGLE_MAP --no-fallback -- \
  python3 - "$VERIFY_SKILL/helpers/control.py" launch --repo "$VERIFY_REPO" --run "$VERIFY_RUN" <<'PYTHON'
import os
import sys
key = os.environ.pop("GOOGLE_MAP", "")
if not key:
    raise SystemExit("Doppler GOOGLE_MAP is empty; value omitted")
os.environ["GOOGLE_MAPS_API_KEY"] = key
os.environ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"] = key
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])
PYTHON
```

A nonempty key only proves injection. Require a rendered map, actual autocomplete results, successful server geocoding, and nonempty routes before marking those features verified. Keep Google request query strings and credential-bearing image URLs out of evidence. Complete or skip the organizer tutorial before entering an address; dismissing it mid-entry moves focus away and can close the autocomplete dropdown.

An optional `WHERE2MEET_NPM_CACHE` selects a reusable npm cache. With no override, the cache is disposable. If the execution sandbox blocks PostgreSQL shared memory, local listeners, dependency downloads, or Chrome, request the normal tool permission for this local run. Do not work around it with production endpoints or mocks.

For a backend migration, keep the existing frontend checkout fixed and pass the candidate backend checkout through `--repo`. Add `--frontend-repo` pointing to the fixed frontend monorepo. Both paths must contain their corresponding `client/` or `server/` package. The run records both commits, working-tree status, and a frontend fingerprint. An explicitly pinned frontend with uncommitted `client/` changes is rejected; use a clean baseline checkout. Default development runs may include local edits and record them. Changing the launch adapter for a new backend must preserve the user-path assertions and be recorded as a harness change.

The temporary run directory must be separate from the source repository's `client/` and `server/` trees. Never launch two drivers against the same run. Independent run directories may run concurrently; every database write first checks that the listener belongs to the run.

## Doctor

```sh
python3 "$VERIFY_SKILL/helpers/control.py" doctor --run "$VERIFY_RUN"
```

This performs read-only application checks and saves `evidence/doctor.json`. It checks process start identities, ownership of all four listening ports, source fingerprint, real database/Redis health, frontend response, and an unauthenticated request through the Next session proxy. It does not insert users, events, or tokens. Run it before driving and whenever an instance looks wrong. A healthy anonymous session should be unauthorized; authenticated session restoration is a separate mapped scenario.

Stop on a failed doctor. Inspect that run's logs. Do not attach to a shared instance, rewrite `run.json` to bless a different process, or interpret `degraded` as full readiness.

## Drive

Run the scripted desktop lifecycle:

```sh
python3 "$VERIFY_SKILL/helpers/control.py" drive --run "$VERIFY_RUN"
```

The script uses the actual `Occasion`, `Your name`, date/time picker, and `Create Meeting` controls. It creates an event without an optional location, checks the saved organizer, reloads to restore identity through `/me`, edits the title, opens the meeting in a separate anonymous browser, and deletes only that synthetic event. It checks backend reads and actual database rows after the UI mutations. It also removes only the cached participant ID and reloads with the original UI-issued token, then requires `/me` to restore the correct ID and organizer controls. It never calls Zustand setters, writes tokens into localStorage, or inserts fixtures into the database.

The script does not prove every entry in [event lifecycle](features/event-lifecycle.md). In particular, phone entry points, clipboard copying, date editing, presets, tutorial completion, and dashboard creation need their own mapped runs. Nor does it prove location, votes, realtime recovery, accounts, old-data import, or production performance. `result.json` names the exercised scope and exclusions. Ordinary reload can pass using cached credentials. The token-only step additionally requires the page to consume `/me` and repair the missing participant ID. It fails on the historical response-field mismatch. This is a stricter assertion than the historical M0 lifecycle evidence.

The real-Google desktop flow is supplied by [helpers/google-browser.mjs](helpers/google-browser.mjs). It creates two participants through separate browsers, verifies actual autocomplete and stored coordinates, searches real venues, checks driving and walking routes against displayed times, and exercises card voting, publishing, and reopening. Run it only after a successful doctor and with the Doppler launch above. It records failures per behavior; a known last-vote synchronization failure remains a failing result even when later publication checks succeed.

```sh
python3 "$VERIFY_SKILL/helpers/control.py" doctor --run "$VERIFY_RUN" && \
  node "$VERIFY_SKILL/helpers/google-browser.mjs" "$VERIFY_RUN"
VERIFY_GOOGLE_STATUS=$?
python3 "$VERIFY_SKILL/helpers/control.py" cleanup --run "$VERIFY_RUN"
test "$VERIFY_GOOGLE_STATUS" -eq 0
```

Always execute cleanup even after a failing driver. If your shell exits on the first failure, run cleanup in a `finally` step in your orchestration instead. Evidence uses the `google-` prefix and `google-result.json`; the ordinary `result.json` belongs to the separate no-location lifecycle driver. Review [current verification coverage](verification-status.md) before interpreting a feature's status.

The [accounts driver](helpers/accounts-browser.mjs) covers registration, sign-in, logout, settings, organizer claims, and separate-browser dashboard access. Token-only `/me` recovery passes with the M1 frontend correction; anonymous-organizer auto-claim remains a failing assertion. Run this full account flow against the old backend while M1 account writes are unavailable. Require every selected check to pass before accepting an account migration. A FAIL result with passing individual checks remains FAIL overall.

```sh
python3 "$VERIFY_SKILL/helpers/control.py" doctor --run "$VERIFY_RUN"
node "$VERIFY_SKILL/helpers/accounts-browser.mjs" "$VERIFY_RUN"
```

Each driver must run by itself. After a failed attempt, clean up and launch a fresh run before retrying. Navigation can discard a captured response body or leave a previous page's response pending. The accounts driver observes UI actions and response status, then corroborates the session and dashboard through read-only requests using that browser's Cookie jar. Its `accounts-*.json` evidence stores Cookie attributes and hash-presence checks without credential values.

For other mapped entries, create a local Playwright script using this bootstrap, insert the relevant feature recipe inside the `try`, and save evidence before `finally` closes the browser:

```js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const runDir = path.resolve(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1');
assert.equal(run.status, 'ready');
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const base = run.client_url;
  await page.goto(base);
  await page.screenshot({ path: path.join(runDir, 'evidence/manual-start.png') });
  await writeFile(path.join(runDir, 'evidence/manual-start.aria.txt'), await page.locator('body').ariaSnapshot());
} finally {
  await browser.close();
}
```

Invoke the saved script with `node "$VERIFY_RUN/feature.mjs" "$VERIFY_RUN"` after doctor passes. Keep recipe mutations inside the browser's `try/finally`. Use independent contexts for other people. Record the selected entry and every action/result; the bootstrap's opening screenshot alone is not a feature proof. Synthetic data may be read through existing APIs or read-only SQL, but create and change it through the UI.

## Evidence

Evidence lives in `$VERIFY_RUN/evidence/` and survives cleanup. Keep the absolute path when reporting a result.

- `doctor.json` records readiness and process ownership. `run.json` records code revisions, source fingerprint, runtime versions, configuration choices, and owned processes.
- `actions.json` records browser actions and observed results. Numbered screenshots and ARIA snapshots show input and resulting views.
- `network.json` records request method, origin, path, and status. It omits authorization, cookies, query strings, and response bodies containing credentials.
- `created-state.json`, `edited-state.json`, and `deleted-state.json` compare public API results with read-only stored values. Identity material is represented only as `has_credential`.
- `result.json` reports PASS/FAIL and the exact scope. Logs and failure screenshots explain incomplete attempts. `cleanup.json` records cleanup and retained evidence.

Capture both the action and resulting state. A screenshot, toast, optimistic count, or green process alone is insufficient. Check persistence, permissions, other browsers, and external effects where the selected feature requires them. Do not publish tokens, passwords, cookies, raw storage state, or unredacted browser traces. Capture synthetic public inputs instead. A mock/provider fixture result must identify the substituted external boundary and cannot stand in for real Google integration.

Keep `FAILED`, `UNVERIFIED`, and `PASS` distinct. Missing keys, skipped entry points, browser errors affecting the selected path, or absent evidence cannot count as success. The automated scenario records Google-related page errors and excludes Google behavior; inspect these alongside its result. Do not normalize new failures into an allowlist simply to keep the migration green.

The legacy server test setup hardcodes ordinary local ports. Candidate tests must accept the isolated URLs and create their own schema. Do not run legacy tests assuming these URLs will be honored.

## Migration fixture and restart

Migration fixtures are separate from the UI lifecycle. [helpers/legacy-fixture.mjs](helpers/legacy-fixture.mjs) calls the old backend's real HTTP create/register/login/claim operations in an owned run. It exports only that synthetic event and account, plus their related rows. Its second session was issued by the old API, then deliberately expired in the local database. It saves rows and credentials privately, outside the repository, and records only provenance, counts, and a content hash in shareable evidence. This is not a production export.

```sh
LEGACY_REPO="/absolute/path/to/pinned-legacy-monorepo"
LEGACY_RUN="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-legacy.XXXXXX")"
FIXTURE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-fixture.XXXXXX")"
PRIVATE_FIXTURE_DIR="$FIXTURE_PARENT/rows"
python3 "$VERIFY_SKILL/helpers/control.py" launch --repo "$LEGACY_REPO" --run "$LEGACY_RUN" --schema-mode push --backend-mode source
node "$VERIFY_SKILL/helpers/legacy-fixture.mjs" "$LEGACY_RUN" "$PRIVATE_FIXTURE_DIR"
```

The private output directory must not already exist. Use the candidate's `server/scripts/import-cli.ts` with the candidate run's database URL to import `rows.json`. Compare all imported fields before authentication can alter a session. Repeat the import and require no changes. Never print or commit `credentials.json` or credential hashes.

```sh
python3 "$VERIFY_SKILL/helpers/control.py" restart-backend --run "$VERIFY_RUN"
```

Restart checks ownership before stopping only that run's backend, preserves its database, and records the old and new process IDs. Run `node "$VERIFY_SKILL/helpers/migration-proof.mjs" "$VERIFY_RUN" "$PRIVATE_FIXTURE_DIR"` to import twice, compare every selected row including the password hash, and verify the old participant token, valid session cookie, and expired cookie before and after restart. It also opens the original event ID in an anonymous browser. Copying a hash is not sufficient proof that the old credential works. Keep the UI lifecycle evidence separate from this fixture-based credential proof. Remove private fixture files after completing the rehearsal.

## Cleanup

```sh
python3 "$VERIFY_SKILL/helpers/control.py" cleanup --run "$VERIFY_RUN"
test -f "$VERIFY_RUN/evidence/result.json"
test -f "$VERIFY_RUN/evidence/cleanup.json"
```

Launch and drive invoke cleanup on failure. Run cleanup explicitly after a successful drive or interrupted attempt too. It signals only recorded process groups whose leader identity still matches, checks for surviving group members, and removes only that run's `runtime/` directory. It never kills by process name or stops an existing Docker service. It preserves `run.json` and `evidence/`.

If cleanup reports `cleanup-incomplete`, keep the directory, inspect the recorded PIDs and group members, and resolve ownership before any manual termination. Do not delete scratch state while a process might still use it. After normal cleanup, confirm the proof files still exist and inspect `cleanup.json`; rerunning cleanup is safe. A failed launch may have no `result.json`; retain its setup log and `launch-failure.json` instead and report the run as failed.

## Helpers

All commands above use [helpers/control.py](helpers/control.py). `launch` owns isolation, `doctor` reads runtime health, `drive` runs [helpers/browser.mjs](helpers/browser.mjs), and `cleanup` tears down the owned run. The browser helper is invoked by `drive`; its direct invocation is `node "$VERIFY_SKILL/helpers/browser.mjs" "$VERIFY_RUN"` after doctor passes, with cleanup required on failure.

[helpers/package.json](helpers/package.json) and its lockfile pin the driver dependency without modifying either application's dependencies. [The feature map](features/README.md) is the maintained user-behavior source. Use `/maintain-verification-skill` when application changes require updating that map or these adapters; keep behavior expectations separate from implementation changes.
