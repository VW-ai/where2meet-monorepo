# Where2Meet

One Git repository for the web client and API server, with both project histories.

Canonical repository: [V1ctor2182/where2meet-monorepo](https://github.com/V1ctor2182/where2meet-monorepo) (private).

```text
client/   Next.js web app      localhost:3001
server/   Fastify + Prisma    localhost:3000
```

## Local development

```sh
npm run install:all
cp client/.env.example client/.env.local
cp server/.env.example server/.env
docker compose -f server/docker-compose.yml up -d
npm --prefix server run db:generate
npm --prefix server run db:push
```

Fill in the map API keys in those local environment files. The examples use a local API at port 3000 and allow the client at port 3001. Start each app in its own terminal:

```sh
npm run dev:server
npm run dev:client
```

Each package keeps its own dependencies and lockfile. The root provides `build:client`, `build:server`, `test:client`, `test:server`, `lint:client`, and `lint:server` commands. See [client docs](client/README.md) and [server conventions](server/CLAUDE.md).

## Deployment

The existing hosting projects use this repository:

| Service | Build root | Deployment |
| --- | --- | --- |
| Vercel `where2meet` | `client` | Git integration deploys `main` to `www.where2meet.org` |
| Railway `where2meet-server`, staging | `/server` | `Server CI` success on `main` triggers `Server CD Staging` |
| Railway `where2meet-server`, production | `/server` | Run `Server CD Production` on `main` with `confirm=deploy` |

Railway Config File Path is `/server/railway.toml` in both environments. Its production API remains at `https://where2meet-server-production.up.railway.app`. Database, Redis, provider environment variables, and domains remain on the existing projects.

GitHub Actions uses the `RAILWAY_SERVICE_NAME` and `RAILWAY_PROJECT_ID` repository variables and environment-scoped project tokens stored as repository secrets `RAILWAY_STAGING` and `RAILWAY_PRODUCTION`. `Railway Auth Check` verifies both tokens without printing them. Client and server CI can also be run manually. The old server repository's CD workflows and direct Railway trigger are disabled so it cannot redeploy the retired source automatically.

Native iOS remains in its separate sibling folder. See [server deployment](server/docs/DEPLOYMENT.md) for operational commands.

## Source history and working changes

The original `VW-ai/Where2meet-v1.0-client` and `VW-ai/where2meet-server` histories were imported under `client/` and `server/`. Commit hashes change because their paths were rewritten; commit ancestry and authorship are retained. Original checkouts remain available outside this repository.

Unfinished client edits remain uncommitted on `fix/seo-geo-audit`; they are separate from the clean `main` branch.
