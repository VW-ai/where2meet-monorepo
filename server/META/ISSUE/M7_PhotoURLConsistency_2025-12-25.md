# Centralize Photo URL Construction

**Date**: 2025-12-25
**Milestone**: 7 (Real-Time Updates)
**Status**: Resolved
**Type**: Code Quality
**Severity**: Low
**GitHub Issue**: #26

---

## Issue

Photo URL construction is duplicated in multiple files, using `process.env` directly instead of the centralized config. This violates single source of truth and makes changes error-prone.

## Current Behavior

```typescript
// src/services/venue.ts:176
const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${process.env.GOOGLE_PLACES_API_KEY}`;

// src/lib/places/search.ts:122
photoUrl: result.photos?.[0]?.photo_reference
  ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${result.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
  : null,
```

**Problems**:
1. URL template duplicated in multiple places
2. Uses `process.env` directly instead of config
3. Magic number `400` for maxwidth not configurable
4. If URL format changes, must update multiple files

## Proposed Solution

Create a central `buildPhotoUrl()` helper function.

### Code Change

```typescript
// src/lib/places/utils.ts (new or existing file)
import { config } from "../config.js";

/**
 * Builds a Google Places photo URL from a photo reference.
 * @param photoReference - The photo_reference from Places API
 * @param maxWidth - Maximum width in pixels (default: 400)
 * @returns Full photo URL
 */
export function buildPhotoUrl(photoReference: string, maxWidth = 400): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${config.GOOGLE_PLACES_API_KEY}`;
}
```

Then update usage sites:

```typescript
// src/services/venue.ts
import { buildPhotoUrl } from "../lib/places/utils.js";
const photoUrl = buildPhotoUrl(photoRef);

// src/lib/places/search.ts
import { buildPhotoUrl } from "./utils.js";
photoUrl: result.photos?.[0]?.photo_reference
  ? buildPhotoUrl(result.photos[0].photo_reference)
  : null,
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/places/utils.ts` | Create `buildPhotoUrl()` helper |
| `src/services/venue.ts` | Use `buildPhotoUrl()` |
| `src/lib/places/search.ts` | Use `buildPhotoUrl()` |

---

## Expected Behavior

- Single source of truth for photo URL format
- Uses centralized config instead of `process.env`
- Easy to change maxWidth or URL format in one place

---

## References

- [Venue service](../../src/services/venue.ts:176)
- [Places search](../../src/lib/places/search.ts:122)
