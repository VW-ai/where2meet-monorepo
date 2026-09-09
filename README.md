# Where2Meet

Find the perfect meeting spot for everyone.

```
client/   Next.js web app        → Vercel   (root directory: client)
server/   Fastify + Prisma API   → Railway  (root directory: server)
```

## Setup

```bash
npm run install:all          # root hooks + client + server dependencies
npm run dev:server           # API on :3000 (see server/README / start.sh for Postgres + Redis)
npm run dev:client           # web on :3001
```

Each package is self-contained: see [client/README.md](client/README.md) and
[server/CLAUDE.md](server/CLAUDE.md). Copy `client/.env.example` → `client/.env.local`
and `server/.env.example` → `server/.env`.

## History

This repo was formed by merging two repositories with their full git history
(`git filter-repo --to-subdirectory-filter`), so `git log` / `git blame` work
across the move:

- `VW-ai/Where2meet-v1.0-client` → `client/`
- `VW-ai/where2meet-server` → `server/`
