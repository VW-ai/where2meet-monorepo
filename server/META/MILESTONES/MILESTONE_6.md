# Milestone 6: Routes + Publish

Google Directions integration and publish venue feature.

---

## Deliverables

### 6.1 Directions Service (Google Directions API)
- [ ] Calculate route: origin → destination
- [ ] Support travel modes: driving, walking, transit, bicycling
- [ ] Return distance, duration, polyline
- [ ] Batch calculation: all participants → one venue
- [ ] Redis caching (TTL: 1 hour)

### 6.2 Directions Route
- [ ] `POST /api/directions` - Calculate routes

### 6.3 Publish Feature
- [ ] `POST /api/events/:id/publish` - Publish final venue
- [ ] Requires organizer token
- [ ] Sets publishedVenueId and publishedAt
- [ ] Prevents further participant changes

### 6.4 Distance/Duration Formatting
- [ ] `value`: always in meters/seconds
- [ ] `text`: imperial by default (miles/feet, mins/hours)
- [ ] Conversion helpers for metric option

### 6.5 Directions DTOs & Mappers
- [ ] Define `DirectionsResponse`, `RouteResponse` in `src/types/responses.ts`
- [ ] Create `src/mappers/directions.mapper.ts` - Google Directions → RouteResponse
- [ ] Include distance/duration formatting in mapper

---

## API Contracts

### Calculate Directions
```
POST /api/directions
Body: {
  "eventId": "evt_...",
  "venueId": "ChIJ...",
  "travelMode": "driving"
}
Response 200: {
  "routes": [
    {
      "participantId": "uuid",
      "distance": { "value": 5200, "text": "3.2 mi" },
      "duration": { "value": 720, "text": "12 mins" },
      "polyline": "encoded_string"
    }
  ]
}
```

### Publish Venue
```
POST /api/events/:id/publish
Headers: Authorization: Bearer {organizerToken}
Body: { "venueId": "ChIJ..." }
Response 200: {
  "id": "evt_...",
  "publishedVenueId": "ChIJ...",
  "publishedAt": "2024-01-15T12:00:00Z",
  ...
}
```

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Calculate routes | POST directions | Routes for all participants |
| Different travel modes | POST with each mode | Different durations |
| Cache hit | Same request twice | Second faster |
| Publish venue | POST publish with token | 200, event updated |
| Publish without token | POST publish | 401 Unauthorized |
| Publish already published | POST publish twice | 409 CONFLICT |
| Add participant after publish | POST participant | 409 EVENT_ALREADY_PUBLISHED |

### Distance Formatting Tests
- [ ] 0.05 miles → "264 ft"
- [ ] 1.5 miles → "1.5 mi"
- [ ] 3600 seconds → "1 hour"
- [ ] 90 seconds → "2 mins"

---

## Dependencies

- Milestone 5 (Voting provides venue selection context)
- Google Directions API enabled

---

## Exit Criteria

- [ ] Routes calculated for all participants
- [ ] All 4 travel modes working
- [ ] Distance/duration formatted correctly (imperial)
- [ ] Publish locks event from changes
- [ ] Only organizer can publish
- [ ] Integration tests for directions + publish flow
