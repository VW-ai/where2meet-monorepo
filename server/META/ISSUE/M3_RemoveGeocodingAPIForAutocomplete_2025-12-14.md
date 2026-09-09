# Issue: Remove Geocoding API - Frontend Uses Places Autocomplete

- **Detected on:** 2025-12-14
- **Milestone:** 3 (Participant Module) - Refactor
- **Owner:** TBD

## Summary

The frontend uses Google Places Autocomplete, which provides coordinates directly when the user selects an address. This makes the backend Geocoding API unnecessary.

**Current flow:**
```
Frontend sends: { name, address }
Backend: geocode(address) → lat/lng
Backend: stores participant with lat/lng
```

**Proposed flow:**
```
Frontend: User selects from Places Autocomplete
Frontend sends: { name, address, lat, lng }
Backend: stores participant directly (no API call)
```

## Benefits

| Aspect | Current | After Refactor |
|--------|---------|----------------|
| Backend API calls | 1 per participant | 0 |
| Response time | +200-500ms (geocoding) | Instant |
| Cost | Geocoding API charges | Free |
| Accuracy | Re-geocoding may differ | Exact user selection |

## Files to Update

| File | Change |
|------|--------|
| `src/schemas/participant.ts` | Add `lat`, `lng` required fields |
| `src/services/participant.ts` | Remove `geocode()` call, use provided coords |
| `src/lib/maps.ts` | Delete or mark as deprecated |
| `src/lib/config.ts` | Remove `GEOCODE_*` config vars |
| `tests/unit/maps.test.ts` | Delete or update |
| `tests/services/participant.test.ts` | Update to not mock geocoding |

## API Contract Change

**Before:**
```json
POST /api/events/:id/participants
{
  "name": "Alice",
  "address": "123 Main St, NYC"
}
```

**After:**
```json
POST /api/events/:id/participants
{
  "name": "Alice",
  "address": "123 Main St, New York, NY 10001",
  "lat": 40.7128,
  "lng": -74.0060
}
```

## Decision

- **Option 1:** Remove geocoding entirely (recommended)
- **Option 2:** Keep as optional fallback (if lat/lng not provided)

## Next Steps

- [ ] Update participant schema to require lat/lng
- [ ] Update participant service to use provided coordinates
- [ ] Remove/deprecate geocoding service
- [ ] Update tests
- [ ] Update API documentation
