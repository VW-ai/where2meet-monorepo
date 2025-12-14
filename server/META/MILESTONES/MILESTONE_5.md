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
- [ ] Cache venue data when first voted (store in Venue table)
- [ ] Prevent duplicate votes (same participant + venue)
- [ ] Aggregate vote counts per venue
- [ ] Return voters list per venue

### 5.3 Venue Caching
- [ ] Store venue info in DB when voted (not just Redis)
- [ ] Link venue to event (for cleanup on event delete)
- [ ] Composite key: (venue_id, event_id)

### 5.4 Input Validation
- [ ] CastVoteSchema: `{ participantId, venueId, venueData }`
- [ ] RemoveVoteSchema: `{ participantId, venueId }`
- [ ] Validate event ID (semantic format), participant UUIDs, and placeId format

### 5.5 Vote DTOs & Mappers
- [ ] Define `VoteResponse`, `VoteStatisticsResponse` in `src/types/responses.ts`
- [ ] Create `src/mappers/vote.mapper.ts` - Vote entity → VoteResponse
- [ ] Controller calls mapper to transform service output

---

## API Contracts

### Cast Vote
```
POST /api/events/:id/votes
Body: {
  "participantId": "uuid",
  "venueId": "ChIJ...",
  "venueData": { "name": "Starbucks", "address": "...", "lat": 40.7, "lng": -74.0, ... }
}
Response 201: { "success": true, "voteId": "uuid" }
```

### Remove Vote
```
DELETE /api/events/:id/votes
Body: { "participantId": "uuid", "venueId": "ChIJ..." }
Response 200: { "success": true }
```

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
| Venue cached | After vote, check DB | Venue row exists |

---

## Dependencies

- Milestone 3 (Participants must exist)
- Milestone 4 (Venues searched before voting)

---

## Exit Criteria

- [ ] Participants can vote for multiple venues
- [ ] Same participant cannot vote same venue twice
- [ ] Vote counts aggregated correctly
- [ ] Venue data persisted in DB on first vote
- [ ] Deleting participant cascades to their votes
- [ ] Integration tests for full voting flow
