# M1 backend progress

The rewrite branch implements the anonymous meeting lifecycle with the existing PostgreSQL schema and formal migrations. `src/app.ts` constructs the application. `src/index.ts` listens on the configured Railway host and port.

Meetings owns event creation, organizer and participant name updates, participant-token authentication, event reads and updates, deletion, stored vote reads, and authenticated notifications. Accounts reads imported sessions and users. Places reads stored venue summaries. HTTP adapters preserve the existing response shapes and validate outgoing data.

Known operations outside this slice return `501 FEATURE_NOT_AVAILABLE`. This includes location changes, account writes, joining, vote writes, publishing, search, and routing. No operation forwards to the legacy backend. The existing migration files and eight-model schema remain unchanged.

Validation results and deployment readiness are tracked in the parent workspace's M1 execution record. This branch is not approved for production traffic.

## M4 implementation

The candidate adds self-only vote mutations, public statistics, organizer publication and reopening, trusted Places preparation, and complete SSE snapshots. The schema and migrations remain unchanged. `tests/voting-publication.test.ts` exercises HTTP, PostgreSQL, Redis, and the provider fixture. Runtime and compatibility limits are in [the M4 reference](../docs/m4-voting-publication.md).

This records implementation scope. Independent review, fixed-frontend browser proof, PPE evidence, and complete CI acceptance remain separate gates. This entry does not approve the candidate for production.
