# Runtime resources

`config.ts` validates environment configuration and optional application overrides. `database.ts` creates the Prisma client, checks readiness, and retries serialization conflicts within a bounded write transaction. `credentials.ts` preserves whole-token SHA-256 hashing and creates new anonymous credentials.

`notifications.ts` uses Redis pub/sub on `where2meet:sse:event:<eventId>`. It tracks local listeners and falls back to local delivery when publishing fails. Readiness reports Redis availability; it does not promise delivery replay.

`app.ts` owns resource shutdown. M1 uses a separate database and never connects to an old backend runtime.
