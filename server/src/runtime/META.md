# Runtime resources

`config.ts` validates environment configuration and optional application overrides. `database.ts` creates the Prisma client, checks readiness, and retries serialization conflicts within a bounded write transaction. `credentials.ts` preserves whole-token SHA-256 hashing and creates new anonymous credentials.

`notifications.ts` uses Redis pub/sub on `where2meet:sse:event:<eventId>`. It tracks local listeners and falls back to local delivery when publishing fails. Readiness reports Redis availability; it does not promise delivery replay.

`app.ts` owns resource shutdown. The migration runtime uses a separate database and never connects to an old backend runtime. It passes Google credentials and the whole-operation geocoding deadline to Places at composition time.

`cache.ts` owns a separate optional Redis connection for provider caches. Disconnected clients bypass reads and writes, and offline queuing is disabled. Each command is bounded by 500 ms and its caller's deadline. Cache failure becomes a miss or an ignored write. Domain providers own normalized codecs, versioned keys, and TTL decisions.

`PUBLIC_API_ORIGIN` sets absolute owned photo URLs. A validated hostname from `RAILWAY_PUBLIC_DOMAIN` is the production fallback. Production fails startup when neither is present. Development and tests may use the actual listening loopback port. Incoming Host headers never supply the origin. Google provider endpoints can be overridden through application composition for local HTTP fixtures, not through public requests.
