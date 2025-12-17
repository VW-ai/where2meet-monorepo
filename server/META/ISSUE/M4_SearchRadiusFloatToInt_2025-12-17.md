# Issue: Accept float searchRadius and round to integer

**Created:** 2025-12-17
**Milestone:** MS4
**Priority:** Low
**Status:** Resolved

## Problem

The venue search endpoint rejects float values for `searchRadius`:

```
"Search radius must be an integer"
```

Frontend may send floats (e.g., from slider calculations or map zoom conversions).

## Current Behavior

```typescript
// src/schemas/venue.ts
searchRadius: z
  .number()
  .int("Search radius must be an integer")  // ← Rejects floats
  .min(100)
  .max(50000)
```

## Proposed Solution

Accept any number and round to nearest integer using Zod transform:

```typescript
searchRadius: z
  .number()
  .min(100, "Search radius must be at least 100 meters")
  .max(50000, "Search radius cannot exceed 50,000 meters")
  .transform((val) => Math.round(val))
```

## Impact

- Non-breaking change (integers still work)
- Improves frontend flexibility
- No precision issues (Google Places API uses integer meters anyway)

## GitHub Issue

See: #10
