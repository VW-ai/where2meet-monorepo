# Issue: Venue Endpoint Authentication Strategy

- **Detected on:** 2025-12-14
- **Milestone:** 4 (Venue Search)
- **Owner:** TBD

## Summary

Currently, venue endpoints (`POST /api/venues/search`, `GET /api/venues/:id`) are implemented without authentication - anyone with an eventId can search for venues and view venue details.

**Current implementation (Option 1):**
- No auth required
- Anyone with eventId can search/view venues

**Proposed future implementation (Option 3):**
- Require organizerToken OR participantToken
- Only event members can access venue functionality
- Frontend autocomplete works without joining event (client-side Google Places)
- Backend Google Places requests only for authenticated event members

## Rationale for Change

| Concern | Current (No Auth) | Proposed (Dual Auth) |
|---------|-------------------|----------------------|
| Access control | Anyone with eventId | Only event members |
| API abuse | Harder to rate-limit | Token-based rate limiting |
| Cost control | Any request hits Google API | Only authenticated requests |
| Privacy | Event location exposed | Protected by membership |

## Impact

**Frontend changes:**
- Autocomplete for address input → Uses Google Places JS SDK directly (no backend)
- Venue search for event → Requires participant/organizer token

**Backend changes:**
```typescript
// Current
fastify.post("/api/venues/search", async (request, reply) => {
  // No auth check
});

// Proposed
fastify.post("/api/venues/search", {
  preHandler: [verifyEventAccess],  // organizerToken OR participantToken
}, async (request, reply) => {
  // Token verified
});
```

## Migration Path

1. **MS4 (current):** No auth - simpler initial implementation
2. **MS5 (voting):** Consider adding auth when voting is implemented
3. **Post-MVP:** Full auth required for all venue endpoints

## Next Steps

- [ ] Decide on auth requirement before MS5 (voting feature)
- [ ] If implementing auth: create `verifyEventAccess` hook (org OR participant)
- [ ] Update frontend to pass token for venue operations
- [ ] Document auth requirements in API spec
