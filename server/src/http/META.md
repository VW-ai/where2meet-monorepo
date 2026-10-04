# HTTP contracts

`routes.ts` adapts public module operations to existing request and response shapes and registers known unavailable routes. `schemas.ts` validates requests and outgoing response data. `errors.ts` maps failures to the nested error envelope.

`sse.ts` authenticates a stream, applies the origin allowlist, writes heartbeat and update frames, and releases timers and subscriptions when the connection closes. It preserves the existing wire payloads without replay or ordering guarantees.

This directory cannot query storage. Unsupported location fields fail before any partial participant update.
