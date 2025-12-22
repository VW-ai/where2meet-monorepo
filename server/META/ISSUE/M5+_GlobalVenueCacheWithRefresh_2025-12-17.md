# Global Venue Cache with Refresh Logic

**Date**: 2025-12-17
**Milestone**: 5 (Voting System)
**Status**: ✅ ADOPTED - This is the M5 design
**Type**: Architecture Decision
**Priority**: High (core M5 design)

---

## ✅ FINAL DECISION: Option A (Global Venue Table)

After discussion, we adopted the **simple global venue approach** for M5:

**Schema**:
```sql
-- Global Venue table (single PK)
Venue (
  id VARCHAR(255) PRIMARY KEY,  -- Google Place ID
  ...venue data...,
  updated_at TIMESTAMP  -- For 5-day refresh logic
)

-- Vote is a junction table
Vote (
  event_id FK -> Event(id),
  participant_id FK -> Participant(id),
  venue_id FK -> Venue(id),  -- References global table
  UNIQUE (event_id, participant_id, venue_id)
)
```

**Key Points**:
- ✅ Simple: One venue table, Vote handles relationships
- ✅ No duplication: Same venue shared across events
- ✅ Cost optimization: 5-day refresh window
- ✅ Supports venue details API from DB
- ❌ Trade-off accepted: Lose historical snapshots (venues update globally)

**Implementation**: See Prisma schema and updated DATABASE_SCHEMA.md

---

## Original Problem Statement (for context)

**Current Design (M5):**
- Venue data is event-scoped (composite PK: `id`, `event_id`)
- Same Google Place duplicated across events
- Database only used for voting statistics, not venue details
- Venue details always served from Redis cache or Google API

**Limitations:**
1. **Data duplication**: Same venue stored multiple times
2. **Wasted API calls**: Fetching same venue repeatedly for different events
3. **Underutilized DB**: Venue table only used for voting, not general venue queries
4. **Redis dependency**: Venue details require Redis or API, even if we have DB data

---

## Proposed Enhancement

### Global Venue Cache with 5-Day Refresh Window

**Concept:**
```
Request: GET /api/venues/:id
         ↓
    Check Redis (24h TTL)
         ↓ miss
    Check PostgreSQL Venue table
         ↓
    Is data fresh (<5 days)?
    ├─ Yes → Return from DB + write to Redis
    └─ No  → Fetch from Google API
             ├─ Update PostgreSQL (set updated_at)
             └─ Write to Redis
```

**Benefits:**
1. **Reduced API costs**: Only refresh every 5 days instead of 24h (Redis TTL)
2. **Persistent cache**: Survives Redis restarts
3. **Cross-event reuse**: One venue serves all events
4. **Fallback layer**: DB as middle layer between Redis and Google API

---

## Architecture Options

### Option A: Replace Event-Scoped with Global Cache

**Schema Change:**
```sql
-- Before (M5): Event-scoped snapshots
Venue (
  id VARCHAR(255),
  event_id VARCHAR(64),
  ...venue data...
  created_at TIMESTAMP,
  PRIMARY KEY (id, event_id)
)

-- After: Global cache
Venue (
  id VARCHAR(255) PRIMARY KEY,
  ...venue data...
  created_at TIMESTAMP,
  updated_at TIMESTAMP,  -- For refresh logic
)
```

**Impact on Voting:**
```sql
-- Vote table references global venue
Vote (
  id UUID PRIMARY KEY,
  event_id VARCHAR(64),
  participant_id UUID,
  venue_id VARCHAR(255),
  FOREIGN KEY (venue_id) REFERENCES Venue(id)  -- No event_id
)
```

**Trade-offs:**
- ✅ Simple (one venue table)
- ✅ No duplication
- ✅ Efficient
- ❌ **Lose historical accuracy**: If venue closes/changes, voting records show updated data, not original

**Example Problem:**
```
2025-01-01: Users vote for "Joe's Pizza" (rating: 4.5, status: open)
2025-06-01: Venue closes, Google updates status
2025-06-02: User views voting results
            → Shows "Joe's Pizza" (status: closed) ❌
            → Should show snapshot from voting time ✓
```

---

### Option B: Hybrid - Global Cache + Event Snapshots

**Two-Table Architecture:**

```sql
-- Table 1: Global venue cache (serves venue details API)
VenueCache (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  address VARCHAR(255),
  ...all venue fields...
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  -- No event_id
)

-- Table 2: Event-scoped snapshots (for voting history)
EventVenueSnapshot (
  id VARCHAR(255),
  event_id VARCHAR(64),
  name VARCHAR(255),
  address VARCHAR(255),
  ...all venue fields...
  created_at TIMESTAMP,  -- When first voted in this event
  PRIMARY KEY (id, event_id)
)

-- Vote table references event snapshot
Vote (
  id UUID PRIMARY KEY,
  event_id VARCHAR(64),
  participant_id UUID,
  venue_id VARCHAR(255),
  FOREIGN KEY (venue_id, event_id) REFERENCES EventVenueSnapshot(id, event_id)
)
```

**Usage:**
- `GET /api/venues/:id` → Use `VenueCache` with 5-day refresh
- `GET /api/events/:id/votes` → JOIN with `EventVenueSnapshot` (frozen history)
- `POST /api/events/:id/votes` → Insert into both tables

**Trade-offs:**
- ✅ Historical accuracy preserved
- ✅ Efficient venue details serving
- ✅ Cross-event reuse
- ❌ Two venue tables (complexity)
- ❌ More storage (duplication still exists)

---

### Option C: Single Table with Nullable event_id

**Schema:**
```sql
Venue (
  id VARCHAR(255),
  event_id VARCHAR(64) NULL,  -- NULL = global cache, NOT NULL = event snapshot
  ...venue data...
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (id, COALESCE(event_id, 'global'))
)
```

**Logic:**
- Global cache entries: `event_id = NULL, is_global = TRUE`
- Event snapshots: `event_id = <uuid>, is_global = FALSE`

**Trade-offs:**
- ✅ One table
- ✅ Flexible
- ❌ Complex queries (need to filter `is_global`)
- ❌ Nullable PK component (messy)

---

## Implementation Details

### Refresh Logic

**Service Layer:**
```typescript
// src/services/venue.ts
async getVenueDetails(venueId: string): Promise<VenueDetails> {
  // 1. Try Redis (24h TTL)
  const cached = await redis.get(`venue:${venueId}`);
  if (cached) return JSON.parse(cached);

  // 2. Try PostgreSQL global cache
  const dbVenue = await db.venue.findUnique({ where: { id: venueId } });

  if (dbVenue) {
    const age = Date.now() - dbVenue.updated_at.getTime();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

    if (age < FIVE_DAYS) {
      // Fresh enough, use DB data
      await redis.set(`venue:${venueId}`, JSON.stringify(dbVenue), 'EX', 86400);
      return dbVenue;
    }
  }

  // 3. Fetch from Google API and update DB
  const apiVenue = await placesApi.getDetails(venueId);

  await db.venue.upsert({
    where: { id: venueId },
    update: { ...apiVenue, updated_at: new Date() },
    create: { ...apiVenue, created_at: new Date(), updated_at: new Date() }
  });

  await redis.set(`venue:${venueId}`, JSON.stringify(apiVenue), 'EX', 86400);
  return apiVenue;
}
```

### Background Refresh Job (Optional)

**Cron job to proactively refresh popular venues:**
```typescript
// Refresh venues that have been voted on recently
async function refreshPopularVenues() {
  const popularVenues = await db.venue.findMany({
    where: {
      updated_at: { lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      votes: { some: {} }  // Has at least one vote
    },
    take: 100
  });

  for (const venue of popularVenues) {
    await getVenueDetails(venue.id);  // Triggers refresh
  }
}
```

---

## Decision Criteria

### Ship in M5 if:
- [ ] Historical accuracy for voting is not critical
- [ ] Willing to accept schema changes before M5 completion
- [ ] Refresh logic is simple (on-demand only, no background jobs)

### Defer to Post-M5 if:
- [x] **Voting historical accuracy is important** (my recommendation)
- [x] Want to ship M5 quickly without architectural debates
- [x] Need time to decide between Option A/B/C
- [x] Want to measure actual API costs before optimizing

---

## Recommendation

**Defer to Post-M5** for these reasons:

1. **M5's goal is voting** - let's ship that first with simple event-scoped snapshots
2. **Historical accuracy matters** - voting results should show what users saw when voting
3. **Optimization can be added later** - doesn't break existing voting functionality
4. **Need design discussion** - Option A/B/C have significant trade-offs

**Suggested Timeline:**
- **M5**: Ship with event-scoped venue snapshots (current design)
- **M6 or M5.1**: Implement global venue cache (Option B - hybrid approach)

---

## Open Questions

1. **Historical accuracy**: How important is it to preserve venue state at voting time?
   - If venue closes, should votes still show original data?
   - Do we need audit trail for venue changes?

2. **Refresh strategy**:
   - On-demand only or background jobs?
   - 5 days reasonable? Should it be configurable?

3. **Storage lifecycle**:
   - When to delete global venue cache entries?
   - Keep forever? Delete after N days with no votes?

4. **Schema choice**:
   - Option A (simple, lose history)
   - Option B (complex, preserve history)
   - Option C (single table with nullable)

---

## Related Issues

- M5_VenuePersistenceDesignClarification_2025-12-17.md (explains event-scoped snapshots)
- M4_VenueEndpointAuthStrategy_2025-12-14.md

---

## Next Steps

- [ ] Discuss with team: historical accuracy requirements
- [ ] Decide: Option A, B, or C
- [ ] Create GitHub issue if moving forward
- [ ] Estimate: schema migration effort if Option B
- [ ] Consider: monitoring for API cost savings

---

## References

- [Google Places API Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- Database denormalization patterns
- Cache-aside pattern with refresh logic
