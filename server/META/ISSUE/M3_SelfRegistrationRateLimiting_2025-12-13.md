# Issue: Rate Limiting for Participant Self-Registration

- **Detected on:** 2025-12-13
- **Milestone:** 3 (Maps + Participant Module)
- **Owner:** TBD
- **Priority:** Medium
- **Status:** Open

## Summary

The participant self-registration endpoint (`POST /api/events/:id/participants` without auth) currently lacks rate limiting, making it vulnerable to spam and abuse.

## Current State

- Self-registration works correctly (no auth required, returns participantToken)
- Global rate limiting exists at server level (100 requests/min)
- **Missing:** Per-IP and per-event rate limiting for unauthenticated requests

## Proposed Solution

### Rate Limits

| Scope | Limit | Window | Rationale |
|-------|-------|--------|-----------|
| Per IP | 10 joins | 1 hour | Prevent spam from single source |
| Per Event | 50 joins | 1 hour | Prevent event flooding |
| Participant Cap | 50 per event | N/A | Hard limit on event size |

### Implementation Options

#### Option A: Fastify Rate Limit Plugin (Recommended)

Use `@fastify/rate-limit` with custom key generator:

```typescript
fastify.post("/api/events/:id/participants", {
  preHandler: [
    verifyOrganizerToken({ optional: true }),
    conditionalRateLimit({
      max: 10,
      timeWindow: "1 hour",
      keyGenerator: (request) => {
        // Only rate limit unauthenticated requests
        if (request.participantAuth) return null; // Skip
        return `join:${request.ip}`;
      },
    }),
  ],
});
```

#### Option B: Redis-Based Custom Limiter

Use Redis INCR/EXPIRE for more flexibility:

```typescript
async function checkSelfJoinRateLimit(ip: string, eventId: string): Promise<void> {
  const ipKey = `ratelimit:join:ip:${ip}`;
  const eventKey = `ratelimit:join:event:${eventId}`;

  const [ipCount, eventCount] = await redis.multi()
    .incr(ipKey)
    .expire(ipKey, 3600)
    .incr(eventKey)
    .expire(eventKey, 3600)
    .exec();

  if (ipCount > 10) throw new RateLimitError("Too many joins from this IP");
  if (eventCount > 50) throw new RateLimitError("Too many joins for this event");
}
```

## Implementation Tasks

- [ ] Choose rate limiting approach (Option A or B)
- [ ] Implement per-IP rate limiting for unauthenticated POST /participants
- [ ] Implement per-event rate limiting
- [ ] Add participant count check (hard cap at 50)
- [ ] Write tests for rate limit behavior
- [ ] Update API documentation with rate limit info

## References

- Related issue: M3_ParticipantSelfRegistration_2025-12-13.md
- Security recommendation from architecture review
