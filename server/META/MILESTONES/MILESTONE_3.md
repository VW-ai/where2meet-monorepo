# Milestone 3: Maps + Participant Module

Google Geocoding integration, participant management, and MEC calculation.

---

## Deliverables

### 3.1 Maps Service (Google Geocoding)
- [ ] Geocode address → `{ lat, lng, formattedAddress }`
- [ ] Redis caching for geocode results (TTL: 30 days)
- [ ] Handle "address not found" gracefully
- [ ] Rate limiting / retry with exponential backoff

### 3.2 Participant Routes
- [ ] `POST /api/events/:id/participants` - Add participant
- [ ] `PATCH /api/events/:id/participants/:pid` - Update participant
- [ ] `DELETE /api/events/:id/participants/:pid` - Remove participant

### 3.3 Participant Service
- [ ] Geocode address on create/update (backend only, reject frontend lat/lng)
- [ ] Apply fuzzy location offset if requested (~0.5-1 mile random)
- [ ] Assign unique color from predefined palette
- [ ] Trigger MEC recalculation after add/update/delete
- [ ] Block changes if event is published

### 3.4 MEC Module
- [ ] Implement Welzl algorithm for Minimum Enclosing Circle
- [ ] Handle edge cases: 0, 1, 2 participants
- [ ] Use Haversine formula for geographic coordinates
- [ ] Return `{ center: { lat, lng }, radiusMeters: number }`

### 3.5 Input Validation
- [ ] AddParticipantSchema: `{ name: string, address: string, fuzzyLocation?: boolean }`
- [ ] Validate name length (1-50 chars)
- [ ] Validate address length (1-255 chars)

---

## API Contracts

### Add Participant
```
POST /api/events/:id/participants
Body: { "name": "Alice", "address": "123 Main St, NYC", "fuzzyLocation": false }
Response 201: { "id": "uuid", "name": "Alice", "location": { "lat": 40.7, "lng": -74.0 }, "color": "coral" }
```

### Get Event (now includes MEC)
```
GET /api/events/:id
Response 200: {
  "id": "...",
  "participants": [...],
  "mec": { "center": { "lat": 40.7, "lng": -74.0 }, "radiusMeters": 5000 }
}
```

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Add participant | POST /api/events/:id/participants | 201, geocoded location |
| Invalid address | POST with "asdfghjkl" | 400 ADDRESS_NOT_FOUND |
| Fuzzy location | POST with fuzzyLocation=true | Location offset applied |
| MEC with 0 participants | GET event | mec: null |
| MEC with 1 participant | GET event | mec.center = participant location |
| MEC with 3 participants | GET event | Valid enclosing circle |
| Add to published event | POST after publish | 409 EVENT_ALREADY_PUBLISHED |

### MEC Algorithm Tests
- [ ] 2 points → center is midpoint, radius is half distance
- [ ] 3 points forming triangle → correct enclosing circle
- [ ] Collinear points → handled correctly

---

## Dependencies

- Milestone 2 (Event Module)
- Google Maps API key configured

---

## Exit Criteria

- [ ] Geocoding works with caching
- [ ] All 3 Participant endpoints working
- [ ] MEC computed correctly for all cases
- [ ] Colors assigned without duplicates (until palette exhausted)
- [ ] Published events reject participant changes
- [ ] Unit tests for MEC algorithm
- [ ] Integration tests for participant flow
