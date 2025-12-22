# Milestone 5: Voting System

Participant voting on venues.

---

## Deliverables

### 5.1 Vote Routes
- [ ] `POST /api/events/:id/votes` - Cast vote
- [ ] `DELETE /api/events/:id/votes` - Remove vote
- [ ] `GET /api/events/:id/votes` - Get vote statistics

### 5.2 Vote Service
- [ ] Validate participant belongs to event
- [ ] Upsert venue into global Venue table (insert if new, update if > 5 days old)
- [ ] Prevent duplicate votes (UNIQUE constraint on event+participant+venue)
- [ ] Aggregate vote counts per venue via JOIN
- [ ] Return voters list per venue

### 5.3 Global Venue Cache (Simplified Design)
- [ ] Store venue in global Venue table with simple primary key `id` (Google Place ID)
- [ ] Add `updated_at` timestamp for 5-day refresh logic
- [ ] Vote table is junction table with FK to global Venue table (not event-scoped)
- [ ] Implement refresh logic: update venue if `updated_at >= 5 days`
- [ ] Venue table shared across all events (no duplication)
- [ ] Deleting event cascades to votes, but NOT to venues (venues are global)

### 5.4 Input Validation
- [ ] CastVoteSchema: `{ participantId, venueId, venueData }`
- [ ] RemoveVoteSchema: `{ participantId, venueId }`
- [ ] Validate event ID (semantic format), participant UUIDs, and placeId format

### 5.5 Vote DTOs & Mappers
- [ ] Define `VoteResponse`, `VoteStatisticsResponse` in `src/types/responses.ts`
- [ ] Create `src/mappers/vote.mapper.ts` - Vote entity → VoteResponse
- [ ] Controller calls mapper to transform service output

---

## Design Rationale

### Global Venue Table with 5-Day Refresh

**Decision**: Single global Venue table (PK: `id`), shared across all events, with 5-day refresh logic.

**Key Benefits**:

1. **No Data Duplication**
   - Same Google Place stored once, regardless of how many events use it
   - Vote table (junction table) tracks which events voted for which venues

2. **Cross-Event Reuse**
   - Once any event votes for a venue, that venue data is available to all events
   - Subsequent events don't need to fetch from Google API

3. **5-Day Refresh Window**
   - Balances data freshness with API cost
   - Refresh logic: if `updated_at >= 5 days`, fetch latest from Google API
   - Much more economical than Redis 24h TTL for frequently-voted venues

4. **Supports Venue Details API**
   - `GET /api/venues/:id` can serve from database (with refresh logic)
   - Three-tier architecture: Redis (24h) → PostgreSQL (5 days) → Google API

5. **Simple Schema**
   - One Venue table (global)
   - One Vote table (junction table for event-participant-venue relationship)
   - No composite keys, no event-scoped snapshots

**Three-Tier Data Flow**:

```
Request: GET /api/venues/:id or POST /api/events/:id/votes
   ↓
1. Check Redis (24h TTL) → Hit? Return
   ↓ Miss
2. Check PostgreSQL Venue table
   ├─ Exists & updated_at < 5 days → Return + write Redis
   └─ Exists & updated_at >= 5 days → Refresh from API, update DB, write Redis
   ↓ Not exists
3. Fetch from Google API → Insert DB, write Redis
```

**Storage Comparison**:

| Data Type | Redis (M4) | PostgreSQL Venue (M5) | Purpose |
|-----------|------------|----------------------|---------|
| Venue search results | ✓ (1h TTL) | ✗ | Temp cache |
| Venue details (not voted) | ✓ (24h TTL) | ✗ | Temp cache |
| **Venue details (voted)** | ✓ (24h TTL) | **✓ (5-day refresh)** | **Global persistent cache** |
| Geocoding | ✓ (30d TTL) | ✗ | Temp cache |

**Trade-offs**:

✅ **Pros**:
- No duplication, simple schema
- Cross-event reuse, cost savings
- Can serve venue details from DB

❌ **Cons** (accepted):
- Lose "historical snapshot" per event (venues update globally)
- If venue closes, all past votes show updated status

**Decision**: Cost savings and simplicity > historical accuracy for this MVP

---

## API Contracts

### Cast Vote
```
POST /api/events/:id/participants/:participantId/votes
Headers: Authorization: Bearer {participantToken|organizerToken}
Body: {
  "venueId": "ChIJ...",
  "venueData": { "name": "Starbucks", "address": "...", "lat": 40.7, "lng": -74.0, ... }
}
Response 201: { "success": true, "voteId": "uuid" }
```

**Auth**: Only can vote for yourself (participantId must match token identity).
Organizer uses their `organizerParticipantId` from event creation.

### Remove Vote
```
DELETE /api/events/:id/participants/:participantId/votes/:venueId
Headers: Authorization: Bearer {participantToken|organizerToken}
Response 200: { "success": true, "deleted": true }
```

**Auth**: Only can remove your own votes.

### Get Vote Statistics
```
GET /api/events/:id/votes
Response 200: {
  "venues": [
    { "id": "ChIJ...", "name": "Starbucks", "voteCount": 3, "voters": ["uuid1", "uuid2", "uuid3"] }
  ],
  "totalVotes": 5
}
```

**Auth**: No authentication required (public statistics).

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Cast vote | POST vote | 201, vote recorded |
| Duplicate vote | POST same vote twice | Idempotent (no error, no duplicate) |
| Vote with invalid participant | POST with fake participantId | 404 PARTICIPANT_NOT_FOUND |
| Participant not in event | POST with participant from other event | 404 PARTICIPANT_NOT_FOUND |
| Remove vote | DELETE vote | 200, vote removed |
| Remove non-existent vote | DELETE | 404 NOT_FOUND |
| Get statistics | GET votes | Correct counts and voters |
| Venue persisted | After first vote, query Venue table | Venue row exists in global table |
| Venue not duplicated | Same venue voted in 2 events | Only 1 venue row, multiple vote rows |
| Venue refresh logic | Vote venue with updated_at > 5 days | Venue updated from Google API |

---

## Dependencies

- Milestone 3 (Participants must exist)
- Milestone 4 (Venues searched before voting)

---

## Exit Criteria

- [ ] Participants can vote for multiple venues (multi-select voting)
- [ ] Same participant cannot vote same venue twice (UNIQUE constraint enforced)
- [ ] Vote counts aggregated correctly via JOIN query with global Venue table
- [ ] Venue persisted in global DB on first vote (upsert logic)
- [ ] 5-day refresh logic implemented (`updated_at` check)
- [ ] Deleting event cascades to votes (but NOT to venues, they're global)
- [ ] Deleting participant cascades to their votes
- [ ] Same venue voted in multiple events → only 1 venue row, multiple vote rows
- [ ] Get statistics returns venue details without calling Google API
- [ ] Integration tests for full voting flow (cast, duplicate, remove, statistics, refresh)
- [ ] Unit tests for vote service and repository
- [ ] Schema validation tests for vote DTOs
