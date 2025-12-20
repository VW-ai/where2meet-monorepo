# Venue Persistence Design Clarification

**Date**: 2025-12-17
**Milestone**: 5 (Voting System)
**Status**: Documentation Updated
**Type**: Architecture Clarification

---

## Issue

The original documentation used the term "cache venue data" which was misleading. The Venue table is not a temporary cache (like Redis), but rather **persistent denormalized storage** for event-scoped venue snapshots.

## Confusion Points

1. **Terminology**: "缓存" (cache) implied temporary storage
2. **Purpose**: Unclear why venues needed to be in database vs Redis
3. **Design rationale**: Benefits of persistence not explicitly documented

## Resolution

Updated documentation to clarify:

### 1. Updated DATABASE_SCHEMA.md

- Changed section title from "场所缓存" to "场所快照 / Persistent Denormalized Storage"
- Added comprehensive design rationale with 5 key benefits:
  1. Referential integrity (FK constraints)
  2. Historical accuracy (preserve data at time of voting)
  3. Query performance (single JOIN query)
  4. Cost optimization (avoid repeated Google API calls)
  5. Reliability (works even if Google API is down)
- Added comparison table: PostgreSQL vs Redis for different data types
- Updated voting flow section with design explanations
- Clarified "不需要的表" section to distinguish cached vs persisted data

### 2. Updated MILESTONE_5.md

- Changed "Cache venue data" to "Persist venue snapshot"
- Added "Design Rationale" section explaining architectural decision
- Updated testing criteria to verify persistence (not just caching)
- Enhanced exit criteria with specific implementation requirements

### 3. Key Terminology Changes

| Old Term | New Term | Meaning |
|----------|----------|---------|
| 缓存 (cache) | 快照 (snapshot) / 持久化存储 (persistent storage) | Permanent database storage |
| Cache venue | Store venue snapshot | Denormalized data with business value |
| Cache time | Created time | When snapshot was first stored |

---

## Architecture Pattern

This is a **two-layer storage architecture** combining Redis caching (M4) with PostgreSQL persistence (M5):

```
Google Places API (source of truth)
         ↓
    [Milestone 4] Redis Cache
         ↓ (ALL venue searches/details, TTL-based)
    1h TTL for search results, 24h TTL for details

         ↓ (ONLY when user votes)
    [Milestone 5] PostgreSQL Venue table
         ↓ (event-scoped persistent snapshot)
    Efficient JOINs for voting statistics
```

**Two Storage Layers**:

1. **Redis (M4)**: Caches ALL Google Places API responses
   - Purpose: Reduce API calls, improve performance
   - Scope: All venue searches and details
   - Lifetime: Short TTL (1-24 hours)

2. **PostgreSQL (M5)**: Stores ONLY voted venues
   - Purpose: Persistent snapshots for voting statistics
   - Scope: Only venues that received at least one vote
   - Lifetime: Permanent (tied to event lifecycle)

**Trade-off**:
- Accept: Data duplication (Redis + PostgreSQL for voted venues, same venue across events)
- Gain: Performance, consistency, reliability, cost savings, referential integrity

---

## Files Updated

1. `/META/ARCHITECTURE/DATABASE_SCHEMA.md`
   - Section 2.3: Venue table design
   - Section 3: What not to store
   - Section 7: Voting data flow

2. `/META/MILESTONES/MILESTONE_5.md`
   - Section 5.2: Vote service
   - Section 5.3: Venue persistence
   - New: Design Rationale section
   - Updated: Testing and exit criteria

---

## Impact

- **No code changes required**: Prisma schema already correctly implements this design
- **Clearer implementation guidance**: Developers understand WHY venues are stored
- **Better testing**: Tests now verify persistence properties, not just caching behavior

---

## References

- Database denormalization patterns
- Event-scoped data isolation
- Historical data preservation (audit trail)
- Cost optimization for external API usage
