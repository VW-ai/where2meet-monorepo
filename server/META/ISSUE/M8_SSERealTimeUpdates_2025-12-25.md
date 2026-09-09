# Implement SSE for Real-Time Updates

**Date**: 2025-12-25
**Milestone**: 8 (Real-Time Updates)
**Status**: Open
**Type**: Feature
**Severity**: High
**GitHub Issue**: #20

---

## Issue

Frontend loads participants once on page mount; no real-time sync. Votes poll every 5s. Users don't see updates from other participants without manual refresh.

### Root Cause (Frontend Report)

- Participants are only loaded once on page mount (`line 74 in src/app/meet/[id]/page.tsx`)
- Votes are polled every 5 seconds, but participants have NO polling mechanism
- When User A adds a participant, User B never sees it without a manual refresh

## Current Behavior

1. User A opens event page → loads participants once
2. User B joins as participant
3. User A's view does NOT update
4. User A must manually refresh to see User B

**Same issue for**:
- Participant updates (name, address changes)
- Participant removals
- Event metadata changes
- Published venue announcements

## Proposed Solution

Implement Server-Sent Events (SSE) for real-time broadcasting of participant, vote, and event changes.

### API Design

```
GET /api/events/:eventId/stream?token={organizerToken|participantToken}

Event Types:
- participant:added    { participant: ParticipantResponse }
- participant:updated  { participant: ParticipantResponse }
- participant:removed  { participantId: string }
- vote:statistics      { venues: VenueWithVotes[], totalVotes: number }
- event:updated        { event: EventResponse }
- event:published      { event: EventResponse, venue: VenueResponse }
- heartbeat            { timestamp: string } (every 30s)
```

### Priority Order

**Priority 1: Participants** (Current issue)
- `POST /api/events/:id/participants` - Participant added
- `PATCH /api/events/:id/participants/:pid` - Participant updated
- `DELETE /api/events/:id/participants/:pid` - Participant removed

**Priority 2: Votes** (Can replace current 5s polling)
- `POST /api/events/:id/participants/:pid/votes` - Vote cast
- `DELETE /api/events/:id/participants/:pid/votes/:vid` - Vote removed

**Priority 3: Event Metadata**
- `PATCH /api/events/:id` - Title/time changed
- `POST /api/events/:id/publish` - Event published with venue

### Authentication

Query string token (recommended for EventSource API compatibility):
```
GET /api/events/:eventId/stream?token=${organizerToken}
```

### Connection Management

- Track connections per event in a Map
- Send heartbeat ping every 30 seconds
- Clean up on disconnect/timeout
- Broadcast to all clients watching that event (except sender)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Fastify Server                          │
├─────────────────────────────────────────────────────────────┤
│  SSE Plugin (src/plugins/sse.ts)                           │
│  ├─ Connection Registry: Map<eventId, Set<SSEConnection>>  │
│  ├─ broadcast(eventId, type, payload)                      │
│  └─ Redis Pub/Sub for horizontal scaling                   │
├─────────────────────────────────────────────────────────────┤
│  Routes emit events after mutations:                        │
│  ├─ participants.ts → participant:added/updated/removed    │
│  ├─ votes.ts → vote:statistics                             │
│  └─ events.ts → event:updated/published                    │
└─────────────────────────────────────────────────────────────┘
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/plugins/sse.ts` | SSE connection manager, broadcast service |
| `src/routes/sse.ts` | `GET /api/events/:eventId/stream` endpoint |
| `src/hooks/sse-auth.ts` | Token validation from query params |
| `src/dto/sse-event.dto.ts` | SSE event payload schemas |
| `src/types/sse.ts` | TypeScript types for SSE |
| `tests/sse.test.ts` | SSE integration tests |
| `META/MILESTONES/MILESTONE_8.md` | Milestone documentation |

## Files to Modify

| File | Change |
|------|--------|
| `src/server.ts` | Register SSE plugin |
| `src/routes/participants.ts` | Emit SSE events after add/update/delete |
| `src/routes/votes.ts` | Emit vote:statistics after vote cast/remove |
| `src/routes/events.ts` | Emit event:updated after PATCH |
| `src/lib/config.ts` | Add SSE config (heartbeat interval, timeout) |

---

## Implementation Phases

### 8.1 Foundation
- Create SSE plugin with connection registry
- Create auth hook for query param tokens
- Add SSE config

### 8.2 Stream Endpoint
- Create GET endpoint with connection lifecycle
- Implement heartbeat and graceful disconnect

### 8.3 Event Broadcasting
- Modify routes to emit after mutations

### 8.4 Redis Pub/Sub (Horizontal Scaling)
- Use existing Redis client for pub/sub
- Publish to `event:{eventId}:updates` channel

### 8.5 Testing
- Connection/event tests
- Mock Redis pub/sub in test environment

---

## Test Cases Needed

1. Connect to stream with valid token → 200, receive heartbeat
2. Connect with invalid token → 401 Unauthorized
3. Connect to non-existent event → 404 Not Found
4. Participant added → receive `participant:added` event
5. Participant updated → receive `participant:updated` event
6. Participant removed → receive `participant:removed` event
7. Vote cast → receive `vote:statistics` event
8. Event updated → receive `event:updated` event
9. Client disconnects → connection cleaned up
10. Server shutdown → graceful disconnect

---

## References

- [Fastify SSE documentation](https://github.com/fastify/fastify-sse-v2)
- [Redis client](../../src/lib/redis.ts)
- [Auth hooks](../../src/hooks/auth.ts)
- [API Specification](../ARCHITECTURE/API_SPECIFICATION.md)
