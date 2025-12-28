# Deployment (Railway + GitHub Actions)

This repo can deploy to Railway in two ways:

1) Railway GitHub integration (Railway auto-deploys on git pushes), or
2) GitHub Actions CD workflows (GitHub triggers `railway up`).

If you want GitHub Actions to control CD, disable Railway's auto-deploy to avoid double-deploys.

## GitHub Actions CD (recommended if you want full control)

Workflows:

- Staging: `.github/workflows/cd-staging.yml`
- Production: `.github/workflows/cd-production.yml`

### Required GitHub config

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

- Variables (repo-level): `RAILWAY_SERVICE_NAME`
- Secret (environment-level):
  - `staging` environment: `RAILWAY_TOKEN` (Project Token scoped to staging)
  - `production` environment: `RAILWAY_TOKEN` (Project Token scoped to production)

### Railway settings

- Disable Railway GitHub integration auto-deploy for this service (so only Actions deploys).
- Ensure the Railway service has the required runtime env vars configured (e.g. `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`).

### How deploy works

- The workflows run `railway up --ci --environment <staging|production> --service <name>`
- The Railway runtime runs DB migrations before start via `railway.toml` (`startCommand`)

## Config as Code

Railway uses `railway.toml` as the source of truth for build/deploy settings:

- Builder: Dockerfile
- Healthcheck: `/health/ready`
