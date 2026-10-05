# M4 voting and publication

M4 implements five complete Meetings operations behind the existing HTTP paths. Account cookies do not authorize these operations. The Prisma schema and migrations are unchanged.

| Request | Authority and state | Response |
| --- | --- | --- |
| POST `/api/events/:id/participants/:participantId/votes` | Exact bearer participant, including organizers. Event must be open. | 201 with `success: true` and `voteId`. A duplicate returns the same ID. |
| DELETE `/api/events/:id/participants/:participantId/votes/:venueId` | Exact bearer participant. Allowed in either publication state. | 200 with `success: true` and `deleted`. An absent vote returns false. |
| GET `/api/events/:id/votes/statistics` | Public. | Complete statistics with `eventId`, diagnostic `seq`, `venues`, `totalVotes`, and construction-time `updatedAt`. |
| POST `/api/events/:id/publish` | Organizer bearer participant. Event must be open. | Complete Event DTO with both publication fields set. |
| DELETE `/api/events/:id/publish` | Organizer bearer participant. Event must be published. | Complete Event DTO with both publication fields null. |

A published cast or duplicate publication returns 409 `EVENT_ALREADY_PUBLISHED`. Duplicate reopening returns 409 `EVENT_NOT_PUBLISHED`. A provider place that does not exist returns 400 `VALIDATION_ERROR`. Provider unavailability returns 502 `EXTERNAL_SERVICE_ERROR`.

HTTP extracts the bearer header, then parses the request body before domain authorization. Isolated error codes are preserved. A request with both a malformed body and an invalid credential can return 400 before the legacy 403, so exact combined-error precedence is not claimed.

## Trusted venue preparation

Vote requests retain the fixed client's `venueData` validation. HTTP discards that data. A first vote or publication resolves `Places.details`, which awaits trusted global Venue persistence before the meeting write transaction begins. Imported summaries and client metadata cannot replace this provider validation. A duplicate vote checks current identity and open state before returning the stored ID without Google.

Provider preparation runs outside Serializable retries. The transaction rechecks event existence, bearer membership, target identity, and publication state. A provider response can refresh the trusted global cache even when the later meeting check rejects the operation. Publication accepts any valid place without a vote, quorum, or winner requirement.

The composite vote key and conflict-safe insert converge concurrent duplicate casts on one stored row. Publication writes both fields together, and reopening clears both together. Duplicate transitions conflict. Overlapping votes and publication follow legal serial histories. The implementation adds no Event write solely to enforce physical commit order.

## Notifications and statistics

After committed vote changes, Meetings reads a complete snapshot and attempts `vote:statistics`. Removing the final vote sends an empty venues array and zero total. Post-commit snapshot or notification failures do not reverse the mutation or turn HTTP success into failure. Publication uses the prepared trusted place for `event:published`, without a second Google call. Reopening sends explicit nulls in `event:updated`.

HTTP statistics includes only `venueId`, `voteCount`, and `voterIds` per venue. SSE retains deprecated `voterNames` with the same IDs. No `vote:changed` delta is emitted. Exact legacy SSE parity is not claimed.

The existing Notifications runtime owns `sse:seq:<eventId>`. It advances once per full vote notice and exposes its current value to HTTP. The legacy extra delta increment is omitted. Redis failure or malformed counters yield a diagnostic zero and report failure. Local SSE fallback remains available during Redis publish failures.

The counter is not a database revision. PostgreSQL snapshots and Redis increments are separate operations. No ordered delivery, durable replay, or atomic snapshot revision is promised. Concurrent notifications can arrive out of order, and the fixed frontend does not reject older snapshots.

## Verification scope

`tests/voting-publication.test.ts` exercises the HTTP API against isolated PostgreSQL schemas, a dedicated local Redis database, actual SSE sockets, and the controllable Places provider fixture. It covers bearer ownership, ignored cookies, poisoned metadata, duplicate votes, vote removal, publication transitions, delayed-provider rechecks, concurrent histories, and Redis failure.

The reproducible server commands are `npm run verify` and `npm run build`. Their results do not establish fixed-frontend browser behavior, real Google behavior, PPE readiness, or CI acceptance. Those remain separate migration gates.
