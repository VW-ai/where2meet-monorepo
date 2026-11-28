# Deployment (Railway + GitHub Actions)

This repo can deploy to Railway in two ways:

1) Railway GitHub integration (Railway auto-deploys on git pushes), or
2) GitHub Actions CD workflows (GitHub triggers `railway up`).

If you want GitHub Actions to control CD, disable Railway's auto-deploy to avoid double-deploys.

## GitHub Actions CD (recommended if you want full control)

Workflow: `.github/workflows/server-cd-production.yml`, run manually on `main` with `confirm=deploy`. There is no staging environment. Test server changes locally against `docker-compose.yml` first.

### Required GitHub config

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

- Variables (repo-level): `RAILWAY_SERVICE_NAME`
- Optional variables (repo-level): `database_url`, `redis_url` (synced to Railway as `DATABASE_URL`/`REDIS_URL` before deploy)
- Secret: `RAILWAY_PRODUCTION` (Project Token scoped to production). The workflow also accepts it as `RAILWAY_TOKEN` in the `production` GitHub environment.

### Railway settings

- Root Directory: `/server`.
- Config File Path: `/server/railway.toml` (the config path does not follow Root Directory automatically).
- A new GitHub repository needs its own environment secrets and variables; these are not part of Git history.

- Disable Railway GitHub integration auto-deploy for this service (so only Actions deploys).
- Ensure the Railway service has the required runtime env vars configured (e.g. `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`).

### How deploy works

- (Optional) The workflow syncs `database_url`/`redis_url` into Railway variables `DATABASE_URL`/`REDIS_URL` (without triggering an extra deploy)
- Then it runs `railway up --ci --environment production --service <name>`
- The Railway runtime runs DB migrations before start via `railway.toml` (`startCommand`, before the Node process starts)

Note: In Railway UI, `DATABASE_URL`/`REDIS_URL` may appear as `${{<id>.DATABASE_URL}}`-style references; Railway resolves these at runtime.

## Config as Code

Railway uses `railway.toml` as the source of truth for build/deploy settings:

- Builder: Dockerfile
- Healthcheck: `/health/ready`

## Free events cron

`railway.cron.toml` configures a second Railway service that runs `node dist/jobs/ingest-free-events.js` once a day at 11:00 UTC (06:00 New York in winter, 07:00 in summer) and exits. It uses the API's Dockerfile. The API service applies migrations on deploy, so deploy the API first.

Railway settings for that service:

- Source: this repo, Root Directory `/server`, Config File Path `/server/railway.cron.toml`.
- Variables: `DATABASE_URL` as a reference to the same Postgres the API uses. Nothing else is required.
- The production CD workflow deploys only `RAILWAY_SERVICE_NAME`, so this service either auto-deploys from `main` or is deployed by hand with `railway up --service <cron service>`.

Each run logs one `ingest done source=<name> upserted=<n> skipped=<n>` line per source, or `ingest failed source=<name> error=<reason>`. A source that is down does not fail the run, so check those lines: zero rows two days in a row means a source changed its format.
