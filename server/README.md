# Where2Meet backend rewrite

This branch implements anonymous meetings, the participant lifecycle, email accounts, meeting claims, trusted places, routing, voting, and publication. It is not a complete production replacement. The MEC endpoint is retired and returns `404 NOT_FOUND`; the frontend calculates geometry locally. See [MEC retirement](docs/mec-retirement.md) and [the PPE scope](docs/railway-ppe.md).

The service uses Fastify, PostgreSQL through Prisma, and Redis notifications. [Source ownership](src/META.md) describes the current modules. Documents under `META/ARCHITECTURE` describe the previous implementation and are not the new module contract.

## Run locally

Use a Node.js LTS version supported by the lockfile. Railway and CI currently use Node.js 20. Supply `DATABASE_URL` and `REDIS_URL` for your own development resources. `PORT` defaults to 3000. Set `CORS_ORIGINS` to the frontend origin; production rejects the wildcard default.

Participant addresses require `GOOGLE_MAPS_API_KEY` with access to the Google Geocoding API. `GEOCODE_TIMEOUT_MS` defaults to 5000 and bounds the entire lookup, including up to three transient-error attempts. Unconfigured or unavailable geocoding returns `502 EXTERNAL_SERVICE_ERROR` without changing participant data. Name-only updates do not require Google.

Fuzzy participant addresses are null in public event responses, mutation responses, and SSE. Authenticated `/me` returns that participant's original address. The existing organizer permission remains in effect, including location and privacy edits for any participant in the event. The frontend must hydrate private self-editor state from `/me`, omit unchanged addresses, and detect saved locations from `location`.

Email accounts use bcrypt-compatible password hashes and seven-day sessions. Claims add meetings to the account dashboard while existing participant credentials continue to authorize meeting edits. Account cookies alone do not restore organizer controls on another device. See [account and claim contracts](docs/m2-accounts.md).

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

The browser compatibility CI runs the real frontend against the compiled backend. It checks the no-location event lifecycle with both the candidate and fixed frontend, and the account lifecycle with the corrected candidate frontend. It runs on backend changes and pull requests targeting development branches. CI does not deploy the branch.

## Rehearse an import

The import command accepts a private JSON export with `version: 1` and scalar model fields. It validates the data, preserves IDs and hashes, and imports all rows in one transaction. Repeating the exact export makes no changes. A conflicting row rejects the import and rolls back the transaction.

```sh
npm run import:data -- /private/path/rows.json
```

The command uses `DATABASE_URL`; check its environment before running it. Keep exports and plaintext test credentials outside Git. [The verification skill](../.agents/skills/verify-where2meet/SKILL.md#migration-fixture-and-restart) generates a synthetic old-server fixture and checks import plus restart in isolated local runs. The production image does not ship this development tool.

Keep migration PRs unmerged. [Railway PPE instructions](docs/railway-ppe.md) separate dedicated PPE acceptance from staging and production release.

M4 vote and publication behavior, trust boundaries, and notification limits are described in [the M4 reference](docs/m4-voting-publication.md).
