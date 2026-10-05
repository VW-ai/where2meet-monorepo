# HTTP contracts

`routes.ts` adapts public module operations to existing request and response shapes and registers known unavailable routes. `schemas.ts` validates requests and outgoing response data. `errors.ts` maps failures to the nested error envelope.

`sse.ts` authenticates a stream, applies the origin allowlist, writes heartbeat and update frames, and releases timers and subscriptions when the connection closes. It preserves the existing wire payloads without replay or ordering guarantees.

This directory cannot query storage. Participant creation distinguishes absent authorization from a supplied credential. A malformed supplied header fails instead of becoming an anonymous join. PATCH maps omitted addresses to retention and rejects empty or null addresses. Public participant responses and broadcasts redact fuzzy addresses; `/me` returns only the authenticated participant's private address.

Participant added and updated frames retain flat coordinates and include `fuzzyLocation`. Removal also emits canonical vote statistics. These events have no replay or sequence guarantee.
