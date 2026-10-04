# Where2Meet backend rewrite

This branch implements the first anonymous meeting lifecycle. It is not a complete production replacement. Unmigrated operations return `501 FEATURE_NOT_AVAILABLE`; see [the PPE scope](docs/railway-ppe.md).

The service uses Fastify, PostgreSQL through Prisma, and Redis notifications. [Source ownership](src/META.md) describes the current modules. Documents under `META/ARCHITECTURE` describe the previous implementation and are not the new module contract.

## Run locally

Use a Node.js LTS version supported by the lockfile. Railway and CI currently use Node.js 20. Supply `DATABASE_URL` and `REDIS_URL` for your own development resources. `PORT` defaults to 3000. Set `CORS_ORIGINS` to the frontend origin; production rejects the wildcard default.

```sh
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run build
npm start
```

Run these commands from `server/`. Migrations initialize a new database. They do not import old rows or establish that a populated historical database can be upgraded in place. Do not point local test commands at production resources.

For the complete isolated frontend and backend setup, use [the project verification skill](../.agents/skills/verify-where2meet/SKILL.md). Its default launcher uses formal migrations and the compiled server.

## Verify changes

`npm run verify` checks all source, tests, and scripts with TypeScript, ESLint, formatting, the module ownership gate, and behavioral tests. Integration tests require a loopback PostgreSQL URL and Redis URL. They create and remove a randomly named test schema, apply the checked-in migrations there, and leave existing schemas alone. The boundary tests include deliberately invalid imports and nested Prisma queries.

```sh
npm run verify
```

The separate browser compatibility CI runs the real frontend against the compiled backend and checks creation, identity recovery, title changes, anonymous sharing, and deletion. It runs on backend changes and pull requests targeting development branches. CI does not deploy the branch.

## Rehearse an import

The import command accepts a private JSON export with `version: 1` and scalar model fields. It validates the data, preserves IDs and hashes, and imports all rows in one transaction. Repeating the exact export makes no changes. A conflicting row rejects the import and rolls back the transaction.

```sh
npm run import:data -- /private/path/rows.json
```

The command uses `DATABASE_URL`; check its environment before running it. Keep exports and plaintext test credentials outside Git. [The verification skill](../.agents/skills/verify-where2meet/SKILL.md#migration-fixture-and-restart) generates a synthetic old-server fixture and checks import plus restart in isolated local runs. The production image does not ship this development tool.

No merge or deployment is part of this development batch. [Railway PPE instructions](docs/railway-ppe.md) separate the pending remote rehearsal from local verification.
