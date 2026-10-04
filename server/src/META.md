# M1 server runtime

`app.ts` composes the modules and HTTP adapters. `makeApp` returns an application without listening. `index.ts` loads configuration, listens on the configured host and port, and closes resources on termination.

The runnable implementation is under this directory. Older architecture and milestone documents under `server/META` describe the previous runtime unless explicitly updated for M1. The unchanged Prisma schema and migrations remain the storage contract.

The current slice supports anonymous meeting creation, name updates, event reads and edits, deletion, participant identity, imported account sessions, stored vote reads, and authenticated SSE. Known unmigrated operations return explicit 501 errors. Nothing forwards to the legacy service.
