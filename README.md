# Where2Meet

One Git repository for the web client and API server, with both project histories.

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

- Vercel: select this repository and set Root Directory to `client`.
- Railway: set Root Directory to `/server` and Config File Path to `/server/railway.toml`.
- GitHub Actions: client and server CI use path filters. Configure the new repository's Railway service variable and environment secrets before using its CD workflows; see [server deployment](server/docs/DEPLOYMENT.md).

This repository consolidation does not change the existing production deployment connections. Native iOS remains in its separate sibling folder.

## Source history and working changes

The original `VW-ai/Where2meet-v1.0-client` and `VW-ai/where2meet-server` histories were imported under `client/` and `server/`. Commit hashes change because their paths were rewritten; commit ancestry and authorship are retained. Original checkouts remain available outside this repository.

Unfinished client edits remain uncommitted on `fix/seo-geo-audit`; they are separate from the clean `main` branch.
