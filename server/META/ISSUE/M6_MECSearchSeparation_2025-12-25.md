# Separate MEC Endpoint from Venue Search

**Date**: 2025-12-25
**Milestone**: 6 (Results & Publishing)
**Status**: Open
**Type**: Feature Enhancement
**Severity**: High
**GitHub Issue**: #18

---

## Issue

Current `POST /api/venues/search` couples two concerns:
1. MEC calculation (geometric center from participants)
2. Venue search (Places API query)

This fails when only the organizer exists (no addresses), and doesn't support the frontend's draggable search circle.

## Current Behavior

1. Frontend calls `POST /api/venues/search` with `eventId`
2. Backend fetches event, calculates MEC from participants
3. If no participants have valid locations → throws error
4. Search is locked to MEC center, cannot be adjusted by user

## Root Cause

The venue search endpoint was designed to automatically determine the search center using MEC. This made sense initially, but:
- Organizer participants have no location (lat/lng are null)
- Users want to drag the search circle to explore different areas
- Search should work before any participants with addresses join

## Use Case

Frontend allows users to **drag the search circle** to any location on the map. The search center should be user-controlled, not locked to MEC. This enables:
- Search before any participants have joined
- Manual exploration of different areas
- Override of MEC suggestion when desired

## Proposed Solution

**Separate MEC from Search** - Two distinct endpoints with clear responsibilities:

### New: MEC Endpoint
```
GET /api/events/:id/mec
Response (200): {
  center: { lat: number, lng: number },
  radiusMeters: number
}
Response (200 - no participants with locations): {
  center: null,
  radiusMeters: null
}
```

### Modified: Search Endpoint
```
POST /api/venues/search
Body: {
  center: { lat: number, lng: number },  // Required - user-provided
  searchRadius: number,                   // Required - 100m to 50,000m
  query?: string,
  categories?: string[]
}
```
- Removes `eventId` from body (no longer needed)
- Adds required `center` field
- No MEC calculation in search

## Frontend Flow

```
1. GET /api/events/:id/mec → display suggested circle on map
2. User accepts MEC position OR drags circle elsewhere
3. POST /api/venues/search with chosen center coordinates
```

## Files to Modify

| File | Change |
|------|--------|
| `src/schemas/venue.ts` | Modify `SearchVenuesSchema`: remove eventId, add center |
| `src/schemas/event.ts` | Add `GetMECSchema` (eventId param validation) |
| `src/services/venue.ts` | Simplify `searchVenues()` to use provided center directly |
| `src/services/event.ts` | Add `getMEC()` method |
| `src/routes/venues.ts` | Update `POST /api/venues/search` to use new schema |
| `src/routes/events.ts` | Add `GET /api/events/:id/mec` route |
| `tests/venues.test.ts` | Update tests for new search schema |
| `tests/events.test.ts` | Add MEC endpoint tests |
| `META/ARCHITECTURE/API_SPECIFICATION.md` | Document changes |

---

## Test Cases Needed

1. MEC endpoint with 0 participants with locations → returns null center
2. MEC endpoint with 1 participant → returns that point, radius 0
3. MEC endpoint with 2 participants → returns midpoint
4. MEC endpoint with 3+ participants → returns Welzl result
5. Search with valid center coordinates → returns venues
6. Search with invalid coordinates (out of range) → validation error
7. Search without center → validation error

---

## References

- [Venue service](../../src/services/venue.ts)
- [Venue routes](../../src/routes/venues.ts)
- [MEC algorithm](../../src/utils/mec.ts)
- [API Specification](../ARCHITECTURE/API_SPECIFICATION.md)
