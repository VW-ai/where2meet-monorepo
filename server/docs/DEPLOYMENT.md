# Railway deployment and verification

## Staging

On a same-repository pull request, `Server CI` first runs its local checks. If they pass, it calls [staging CD](../../.github/workflows/server-cd-staging.yml) for GitHub's PR test merge commit. Before upload and after browser acceptance, the job checks the live PR's open state, repository, head, base, and test merge revision. A changed PR cannot pass on stale evidence. Fork PRs do not get the staging credential and cannot pass this gate.

After merge, a successful `Server CI` push for the current `main` commit runs the same staging verification again. Manual dispatch is not a staging bypass. PR and post-merge runs share one staging deployment lock. A new request cannot cancel a running job, but GitHub may replace an older pending job; rerun a canceled PR job. The PR `CI required` check needs staging success; it accepts a skipped staging job only for push, merge-group, or manual CI events.

Before upload, the job checks the fixed Railway project, staging environment and backend service; the backend's resolved `DATABASE_URL` and `REDIS_URL` must equal those of the staging PostgreSQL and Redis services. The backend service must have no GitHub or image source attached, so Railway cannot deploy around this workflow. `CORS_ORIGINS` must explicitly include `http://127.0.0.1:4317` without a wildcard. Set these in Railway while preserving the existing allowed origins. The workflow deliberately fails before deployment if a prerequisite is missing.

Railway's source attachment belongs to the service shared by staging and production; disconnecting it affects both environments. It does not stop the active deployments. Production remains deployable through its separate manual GitHub Actions workflow. The CORS variable is environment-scoped; use `--skip-deploys` when preparing staging so the change takes effect with the next approved deployment.

The workflow receives only the repository's `RAILWAY_STAGING` secret. Its deployment job records the `staging` GitHub environment, but that environment currently has no protection rules or environment-scoped secret. The Railway token must itself be scoped to staging. The fixed project, environment, and service IDs and the preflight checks limit the target, but they do not replace token scoping. Same-repository PR authors can change the workflow and scripts that run with this token, so branch write access is a trust boundary.

The job uploads the approved checkout, captures Railway's deployment ID, then requires that ID to be the sole active successful deployment. Its manifest must use `/server`, `/server/railway.toml`, the Dockerfile, migration start command, and `/health/ready`. The HTTP readiness response must report the same Railway deployment ID with healthy PostgreSQL and Redis.

Each PR deploys into the same persistent staging database and applies its migrations. Browser cleanup removes its test event, not schema changes. PR migrations must remain compatible with subsequent candidate and `main` deployments; use isolated PPE for rehearsals that cannot meet that requirement.

GitHub Actions builds a production-mode Next.js frontend from the same checkout with mocks off and the staging backend URL baked in. It starts that image **only on the CI runner's loopback port**. The staging browser check uses this temporary frontend; it does not connect to the hosted or production frontend. It creates a no-location meeting, reloads organizer identity, edits the title, checks a fresh guest view, and deletes the meeting. A private receipt permits a final cleanup retry if the browser stops after creation. Only sanitized result and cleanup files are uploaded. The job removes its own frontend container before success.

This initial staging check does not cover Google Maps, routes, votes, publication, accounts, or historical-data import. Keep the [PPE verification recipe](../../.agents/skills/verify-where2meet/ppe.md) and PR boundary checks for those behaviors. A passing staging deployment is evidence for the listed no-location flow and the exact uploaded deployment, not for every product feature.

## Production

[Production CD](../../.github/workflows/server-cd-production.yml) remains a separate manual workflow with its own Railway environment secret and confirmation input. It has not yet been changed to require a staging evidence artifact. Do not describe a staging success as an automatic production release.

Railway runs migrations before starting the Node process through `server/railway.toml`. Keep `DATABASE_URL`, `REDIS_URL`, and `CORS_ORIGINS` scoped to their intended environment. The production workflow still supports optional GitHub `database_url` and `redis_url` variable synchronization; staging reads Railway's existing references and does not sync those variables.
