# Add Database Index for Participant Token Lookup

**Date**: 2025-12-25
**Milestone**: 7 (Real-Time Updates)
**Status**: Open
**Type**: Performance
**Severity**: Medium
**GitHub Issue**: #22

---

## Issue

`findParticipantByToken(eventId, tokenHash)` performs a table scan for SSE authentication. At scale with many participants per event, this becomes O(n) instead of O(1).

## Current Behavior

1. SSE connection request comes in with token
2. `findParticipantByToken()` queries: `WHERE eventId = ? AND tokenHash = ?`
3. Database scans all participants for the event to find matching token hash
4. Performance degrades linearly with participant count

## Root Cause

The Participant model in Prisma schema has no composite index on `(eventId, tokenHash)`:

```prisma
model Participant {
  id        String   @id @default(uuid())
  eventId   String
  tokenHash String?
  // ... other fields

  event     Event    @relation(fields: [eventId], references: [id])

  @@index([eventId])  // Only eventId indexed, not tokenHash
}
```

## Proposed Solution

Add a composite index on `(eventId, tokenHash)` to enable constant-time lookups.

### Code Change

```prisma
model Participant {
  // ... existing fields

  @@index([eventId])
  @@index([eventId, tokenHash])  // NEW: Composite index for token lookup
}
```

## Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `@@index([eventId, tokenHash])` to Participant |

## Migration Steps

```bash
npx prisma migrate dev --name add_participant_token_index
```

---

## Expected Behavior

- Token lookup becomes O(1) regardless of participant count
- SSE authentication latency remains constant at scale

---

## References

- [Participant service](../../src/services/participant.ts) - `findParticipantByToken()`
- [SSE routes](../../src/routes/sse.ts) - Token validation for stream endpoint
