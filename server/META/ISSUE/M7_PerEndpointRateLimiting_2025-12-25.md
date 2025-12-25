# Add Per-Endpoint Rate Limiting

**Date**: 2025-12-25
**Milestone**: 7 (Real-Time Updates)
**Status**: Open
**Type**: Security / Cost Control
**Severity**: High
**GitHub Issue**: #23

---

## Issue

Global rate limiting exists, but high-cost endpoints need tighter, endpoint-specific limits:
- Self-registration triggers geocoding API calls ($)
- `/api/venues/search` triggers Places API calls ($$)

Without per-endpoint limits, a single user can exhaust API quotas or run up costs.

## Current Behavior

1. Global rate limit applies uniformly to all endpoints
2. No special protection for expensive endpoints
3. User can call `/api/venues/search` repeatedly, burning Places API quota

## Root Cause

Rate limiting is configured globally in `src/server.ts` without per-route overrides:

```typescript
await server.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW_MS,
});
```

## Proposed Solution

Add endpoint-specific rate limits using `@fastify/rate-limit` per-route configuration.

### Code Change

```typescript
// src/routes/participants.ts - Self-registration
fastify.post("/api/events/:id/participants", {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    }
  }
}, handler);

// src/routes/venues.ts - Venue search
fastify.post("/api/venues/search", {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    }
  }
}, handler);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/participants.ts` | Add rate limit config to POST (self-registration) |
| `src/routes/venues.ts` | Add rate limit config to POST /api/venues/search |
| `src/lib/config.ts` | (Optional) Add configurable endpoint limits |

---

## Expected Behavior

- Self-registration: max 10 requests/minute per IP
- Venue search: max 20 requests/minute per IP
- 429 Too Many Requests returned when exceeded
- Global rate limit still applies to other endpoints

---

## Test Cases Needed

1. Exceed self-registration limit -> 429
2. Exceed venue search limit -> 429
3. Other endpoints still use global limit

---

## References

- [@fastify/rate-limit docs](https://github.com/fastify/fastify-rate-limit)
- [Participant routes](../../src/routes/participants.ts)
- [Venue routes](../../src/routes/venues.ts)
