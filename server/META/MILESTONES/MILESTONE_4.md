# Milestone 4: Venue Search

Google Places integration and venue search functionality.

---

## Deliverables

### 4.1 Places Service (Google Places API)
- [ ] Text Search: query string → venue list
- [ ] Nearby Search: center + radius + categories → venue list
- [ ] Place Details: placeId → full venue info
- [ ] Redis caching (TTL: 1 hour for search, 24 hours for details)
- [ ] Rate limiting / retry logic

### 4.2 Venue Routes
- [ ] `POST /api/venues/search` - Search venues
- [ ] `GET /api/venues/:id` - Get venue details

### 4.3 Venue Service
- [ ] Get MEC center from event (search center, not user-provided)
- [ ] Accept user-provided searchRadius
- [ ] Support text search, category filter, or both
- [ ] Sort results by rating/distance
- [ ] Transform Google response to our Venue format

### 4.4 Input Validation
- [ ] SearchVenuesSchema: `{ eventId, searchRadius, query?, categories? }`
- [ ] Require at least one of query or categories
- [ ] Validate searchRadius > 0

---

## API Contracts

### Search Venues
```
POST /api/venues/search
Body: {
  "eventId": "uuid",
  "searchRadius": 5000,
  "query": "coffee",
  "categories": ["cafe"]
}
Response 200: {
  "venues": [
    { "id": "ChIJ...", "name": "Starbucks", "rating": 4.2, "location": {...} }
  ],
  "totalResults": 15
}
```

### Get Venue Details
```
GET /api/venues/ChIJ...
Response 200: {
  "id": "ChIJ...",
  "name": "Starbucks",
  "address": "123 Main St",
  "rating": 4.2,
  "priceLevel": 2,
  "photoUrl": "https://...",
  "openingHours": [...]
}
```

---

## Supported Categories

| Category | Google Places Type |
|----------|-------------------|
| cafe | cafe |
| restaurant | restaurant |
| bar | bar |
| park | park |
| library | library |
| gym | gym |

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Search with query | POST search with "starbucks" | Venues returned |
| Search with category | POST search with ["cafe"] | Cafes returned |
| Search without eventId | POST without eventId | 400 Validation error |
| Search with no query/categories | POST with neither | 400 Validation error |
| Event has no participants | POST search | 400 No MEC available |
| Get venue details | GET /api/venues/:id | Full venue info |
| Cached search | Same search twice | Second is faster (cache hit) |

---

## Dependencies

- Milestone 3 (MEC must exist for search center)
- Google Places API enabled

---

## Exit Criteria

- [ ] Text search returns relevant venues
- [ ] Category filter works correctly
- [ ] Search uses MEC center (not user-provided)
- [ ] Results sorted by rating
- [ ] Caching reduces API calls
- [ ] Integration tests for search flow
