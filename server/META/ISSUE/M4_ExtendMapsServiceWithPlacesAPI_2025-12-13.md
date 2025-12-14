# Issue: Extend Maps service with Google Places API

- **Detected on:** 2025-12-13
- **Milestone:** 4 (Suggestions Module)
- **Owner:** TBD

## Summary

The current `src/lib/maps.ts` module only implements geocoding (address → coordinates). For the Suggestions module (MS4), we need to extend it with Google Places API functionality to search for venues near the MEC center.

**Current implementation:**
```typescript
// src/lib/maps.ts
geocode(address: string): Promise<GeocodeResult>
```

**Required additions for MS4:**
```typescript
// Venue search near a location
searchNearbyPlaces(center: GeoPoint, radiusMeters: number, type?: PlaceType): Promise<Place[]>

// Get detailed info about a specific venue
getPlaceDetails(placeId: string): Promise<PlaceDetails>
```

## Impact

| Feature | Current | Needed for MS4 |
|---------|---------|----------------|
| Address → Coordinates | ✅ geocode() | ✅ Done |
| Venue search | ❌ Missing | Required |
| Place details | ❌ Missing | Required |
| Redis caching | ✅ For geocode | Extend for Places |

**Google APIs involved:**
- Geocoding API ✅ (implemented)
- Places API - Nearby Search (needed)
- Places API - Place Details (needed)

## Proposed Implementation

### 1. Place Types Enum
```typescript
export type PlaceType =
  | "restaurant"
  | "cafe"
  | "bar"
  | "park"
  | "movie_theater"
  | "bowling_alley"
  | "shopping_mall";
```

### 2. Place Interface
```typescript
export interface Place {
  placeId: string;
  name: string;
  address: string;
  location: GeoPoint;
  types: string[];
  rating?: number;
  priceLevel?: number;
  openNow?: boolean;
}
```

### 3. Functions to Add
- `searchNearbyPlaces()` - Nearby Search API with caching
- `getPlaceDetails()` - Place Details API with caching
- Reuse existing retry logic and error handling patterns

### 4. Caching Strategy
- Cache nearby search results by `center:radius:type` key
- Shorter TTL than geocode (e.g., 1 hour) since venue data changes
- Cache place details by `placeId`

## Next Steps

- [ ] Implement `searchNearbyPlaces()` in MS4
- [ ] Implement `getPlaceDetails()` in MS4
- [ ] Add Places-specific error types
- [ ] Write unit tests with mocked Places API
- [ ] Update config for Places API timeout/cache TTL
