---
name: verify-where2meet
description: Starts the Where2Meet web stack locally (Postgres, Redis, the Fastify API and the Next.js client) and drives it in Chromium with Playwright to prove a change works. Use to run, screenshot, or verify where2meet, before saying a client or server change is done, and for live swarm lanes.
---

# Verify Where2Meet

This skill starts one isolated Where2Meet stack from the current checkout, checks it, drives a user journey in a real browser, and keeps the evidence. The user surface is the web client. The API is a second surface that only the client and `curl` read.

All scripts live in `.claude/skills/verify-where2meet/scripts/` and run from any directory. Paths below are relative to the repo root.

## Launch

```bash
.claude/skills/verify-where2meet/scripts/up.sh
```

It needs Docker with Compose 2.24 or later, Node 20 or later, `lsof`, `curl`, `git` and `perl`.

`up.sh` does these steps, in order:

1. It refuses to start when a port is taken, and names the owner. It also refuses when this checkout already runs an instance.
2. It starts Postgres 16 and Redis 7 from `server/docker-compose.yml` under the compose project `w2m-verify-<api port>`, with a fresh volume.
3. It runs `npm ci` in `server/` and `client/` when `node_modules` is missing or older than the lockfile.
4. It runs `prisma generate` and `prisma migrate deploy`. The database starts empty, and no journey needs seed rows.
5. It starts the API with `tsx src/index.ts` and the client with `next dev`, each in its own process group.
6. It waits until `GET /health/ready` reports the database ok and `GET /blog` lists posts.

Ready is this line, with the git SHA each package runs:

```
where2meet ready server=<sha> at http://localhost:3000 client=<sha> at http://localhost:3001
```

On Victor's Mac with a warm npm cache, a start with no `node_modules` took 22 seconds and a start with them took 11 seconds. An empty npm cache adds the package downloads.

Ports default to API 3000, client 3001, Postgres 5434 and Redis 6380. Shift them with `W2M_API_PORT`, `W2M_WEB_PORT`, `W2M_PG_PORT` and `W2M_REDIS_PORT`. Give the same values to every script in this skill.

### Maps key

When `doppler` is installed and signed in, `up.sh` reads `GOOGLE_MAPS_WEB_API_KEY` from Doppler project `where2meet-ios`, config `prd`, and passes it to the API and client as process environment only. No script prints it or writes it to disk. Without Doppler, or with `W2M_DOPPLER=0`, the stack runs with no key. The map and address search then fail. Blog-post and city-page do not need the key. No run has checked create-event without it. A Doppler login can be scoped to a directory. A checkout under `/tmp` got no key on Victor's Mac, and `up.sh` said so.

### A second instance

Next allows one dev server per client directory, so a second instance needs a second checkout. Make a worktree, then shift every port.

```bash
git worktree add ../w2m-second HEAD
cd ../w2m-second
W2M_API_PORT=3100 W2M_WEB_PORT=3101 W2M_PG_PORT=5534 W2M_REDIS_PORT=6480 .claude/skills/verify-where2meet/scripts/up.sh
```

Run `up.sh` twice from one checkout and it refuses with that reason.

## Doctor

```bash
.claude/skills/verify-where2meet/scripts/doctor.sh
```

Doctor is read-only. Run it first whenever anything looks wrong. It prints one `ok` or `FAIL` line per check and exits non-zero when any check fails.

- Postgres and Redis containers on their ports belong to this run's compose project and report healthy.
- The process on the API port and the process on the client port run from this checkout and belong to the process groups `up.sh` started.
- Each package still runs the SHA it was launched at. A new commit or an edit after launch fails this check, because the API does not reload. Restart with `down.sh` and `up.sh`.
- `GET /health/ready` returns 200 with database and Redis ok, and `GET /blog` returns 200.
- A `warn` line says when no Maps key was injected.

## Drive

```bash
node .claude/skills/verify-where2meet/scripts/drive.mjs <flow> [--phone] [--out <dir>]
```

`drive.mjs` runs one journey in headless Chromium at 1280 x 900, or at 390 x 844 as a touch phone with `--phone`. The flows are `create-event`, `join-and-vote`, `blog-post` and `city-page`. Each flow is described in [features/](features/README.md). It prints a JSON result and exits non-zero on failure, with a `failure.png` of the last page.

Every new browser context starts with the organizer tutorial marked as seen, as for a returning visitor. The tutorial overlay otherwise blocks clicks on the event page.

`drive.mjs` finds Playwright in this order:

1. The directory in `W2M_PLAYWRIGHT`, for example `/Users/victor/victor/victor-ui/node_modules/playwright` on Victor's Mac.
2. `node_modules/playwright` in the current directory.
3. `~/victor/victor-ui/node_modules/playwright`.
4. `/tmp/verify-where2meet/tools`. When none of these exists, `drive.mjs` installs `playwright@1.63.0` there and runs `npx playwright install chromium`.

For a step no flow covers, write a short Playwright script with the same locators, or use the session's browser tools against `http://localhost:3001`. Prefer roles and accessible names, as `drive.mjs` does.

To read stored state, run a read-only query in the run's database.

```bash
.claude/skills/verify-where2meet/scripts/sql.sh "select id, title from event order by created_at desc limit 5"
```

Tables use snake_case names: `event`, `participant`, `vote`, `venue`.

## Evidence

Evidence goes to `/tmp/verify-where2meet/`.

- `evidence/<timestamp>-<flow>[-phone]/` holds the screenshot, an ARIA snapshot of the page, and `result.json` from `drive.mjs`. Save `sql.sh` output next to them.
- `logs/` holds the API, client, compose, Prisma and `npm ci` logs for each API port.

A proof follows these standards.

- Drive the real user path in the browser. Do not call the API to create the state you then check.
- Capture the action and the resulting state. Pair every screenshot with a `sql.sh` row or a `result.json` field that shows the side effect.
- Name the flow, the viewport, and the SHA from Doctor in the report.
- A journey that cannot reach its end state fails. Record the reason, and do not swap in an easier path.

## Cleanup

```bash
.claude/skills/verify-where2meet/scripts/down.sh
```

`down.sh` stops the process groups `up.sh` recorded, removes the compose project and its database volume, and deletes `/tmp/verify-where2meet/run-<api port>/`. It never kills by process name. It keeps `evidence/` and `logs/`. A second run exits 0.

## Helpers

| Script | Use |
|--------|-----|
| `scripts/up.sh` | Start the stack and wait for ready |
| `scripts/doctor.sh` | Read-only health and ownership check |
| `scripts/drive.mjs` | Run one journey in Chromium and save evidence |
| `scripts/sql.sh` | One read-only query against this run's database |
| `scripts/down.sh` | Stop the stack and keep the evidence |
| `scripts/lib.sh` | Shared ports and paths, sourced by the shell scripts |
