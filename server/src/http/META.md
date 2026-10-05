# HTTP contracts

`routes.ts` adapts public module operations to existing request and response shapes and registers known unavailable routes. `schemas.ts` validates requests and outgoing response data. `errors.ts` maps failures to the nested error envelope.

`sse.ts` authenticates a stream, applies the origin allowlist, writes heartbeat and update frames, and releases timers and subscriptions when the connection closes. It maps typed domain notices to SSE payloads without replay or ordering guarantees.

This directory cannot query storage. Participant creation distinguishes absent authorization from a supplied credential. A malformed supplied header fails instead of becoming an anonymous join. PATCH maps omitted addresses to retention and rejects empty or null addresses. Public participant responses and broadcasts redact fuzzy addresses; `/me` returns only the authenticated participant's private address.

Participant added and updated frames retain flat coordinates and include `fuzzyLocation`. Removal also emits canonical vote statistics. These events have no replay or sequence guarantee.

Account routes retain the existing response envelopes and session cookie. Registration and login set an HttpOnly, SameSite=Lax, Path=/ cookie with the lifetime supplied by Accounts; production adds Secure. Logout clears it only after successful revocation. Session reads do not issue cookies. Account authentication precedes profile and claim body validation. Claim user IDs come from that session, and Meetings independently verifies the supplied participant credential. Dashboard summaries do not expose credentials or locations.

Places search and details retain their full JSON shapes. `places.ts` projects domain photo availability into absolute owned URLs for search, details, and vote summaries. Photo GET returns an allowlisted 302 with no-store, a 404 for no photo, or a 502 for provider failure. No Google key or photo reference appears in these responses.

Directions retains successful route rows followed by legacy null rows for unlocated participants. Its additive outcomes collection records every selected participant as found, no-location, no-route, or unavailable. Located failures never become null drawable rows. All-failed calculations return explicit unavailable outcomes with HTTP 200. Missing destinations retain 400, while invalid or unavailable provider data produces 502. Response schema failures remain server errors rather than request-validation errors.

M4 restores vote POST and DELETE, public vote statistics, publication, and reopening. HTTP validates the legacy `venueData` shape but discards it before calling Meetings. Publication responses use the full Event DTO. Publication emits `event:published` with the prepared trusted venue. Reopening emits `event:updated` with explicit null publication fields.

Vote SSE sends complete `vote:statistics` snapshots. HTTP statistics contains `voterIds`; SSE also preserves deprecated `voterNames` containing the same participant IDs. No `vote:changed` delta is emitted. This preserves the fixed frontend's snapshot behavior but does not claim exact legacy SSE parity. The runtime supplies a diagnostic `seq`; it is not a database revision or replay cursor. MEC remains the only registered 501 operation.
