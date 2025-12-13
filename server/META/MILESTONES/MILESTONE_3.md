# Milestone 3: Maps + Participant Module

Google Geocoding integration, participant management, and MEC calculation.

---

## Prerequisites (Completed in MS2)

The following were completed as part of Milestone 2 DTO refactoring:

- [x] `src/dto/` folder with Zod schemas + TypeScript types
- [x] `src/dto/participant.dto.ts` - ParticipantResponseSchema
- [x] `src/dto/event.dto.ts` - MECResponseSchema, EventResponseSchema
- [x] `src/mappers/event.mapper.ts` - includes toParticipantResponse()
- [x] EventService returns raw entities, transformation in route handlers
- [x] Prisma schema has Participant model with all required fields

---

## Deliverables

### 3.1 MEC Module (Pure Algorithm)

Location: `src/lib/mec.ts`

**Implementation:**
- [ ] Implement Welzl's randomized algorithm for Minimum Enclosing Circle
- [ ] Use Haversine formula for geographic distance calculations
- [ ] Project lat/lng to local Cartesian plane for Welzl (fine for city-scale)
- [ ] Return `{ center: { lat, lng }, radiusMeters: number } | null`

**Edge Cases:**
- [ ] 0 participants → return `null`
- [ ] 1 participant → center = participant, radius = 0
- [ ] 2 participants → center = midpoint, radius = half distance
- [ ] 3+ participants → Welzl algorithm
- [ ] Collinear points → handled correctly

**Unit Tests:** `tests/unit/mec.test.ts`
- [ ] Known geometric cases with expected results
- [ ] Edge cases (0, 1, 2, 3 points)
- [ ] Collinear points
- [ ] Large radius (cross-city distances)

---

### 3.2 Maps Service (Google Geocoding)

Location: `src/lib/maps.ts` or `src/services/maps.ts`

**Core Function:**
- [ ] `geocode(address: string)` → `{ lat, lng, formattedAddress }` or throws `AddressNotFoundError`

**Caching (Redis):**
- [ ] Cache key: normalized address (lowercase, trimmed) or formattedAddress from Google
- [ ] TTL: 30 days (`GEOCODE_CACHE_TTL_SECONDS = 2592000`)
- [ ] Cache miss → call Google API → cache result
- [ ] Cache hit → return cached result
- [ ] Redis failure → proceed without cache (log warning, don't block request)

**Resilience:**
- [ ] Timeout budget: 5-10 seconds max for Google API call
- [ ] Retry with exponential backoff (max 3 attempts)
- [ ] Backoff schedule: 100ms, 400ms, 1600ms (with jitter)
- [ ] Retry only on 429/5xx, not on 4xx client errors
- [ ] Circuit breaker consideration (optional for MVP)

**Error Handling:**
- [ ] Google returns 0 results → throw `AddressNotFoundError`
- [ ] Google returns multiple results → use first result (highest confidence)
- [ ] Google API error → throw `ExternalServiceError` (don't expose raw error)
- [ ] Validate returned coordinates are in valid range (-90≤lat≤90, -180≤lng≤180)

**Environment Config:**
- [ ] `GOOGLE_MAPS_API_KEY` in config
- [ ] `GEOCODE_CACHE_TTL_SECONDS` (default 2592000)
- [ ] `GEOCODE_TIMEOUT_MS` (default 5000)

---

### 3.3 Participant Repository

Location: `src/repositories/participant.ts`

**Functions:**
- [ ] `create(data)` → Participant entity
- [ ] `findById(id)` → Participant | null
- [ ] `findByIdWithEvent(id)` → Participant with Event | null (for status checks)
- [ ] `update(id, data)` → Participant entity
- [ ] `delete(id)` → void
- [ ] `findByEventId(eventId)` → Participant[] (for color assignment)
- [ ] `countByEventId(eventId)` → number (for limits check)

---

### 3.4 Participant Service

Location: `src/services/participant.ts`

**Business Logic Order (fail-fast to save quota):**

```
addParticipant(eventId, input):
  1. Validate event exists → EventNotFoundError (404)
  2. Check event not published → EventAlreadyPublishedError (409)
  3. Check participant limit not exceeded (optional)
  4. Geocode address → AddressNotFoundError (400)
  5. Apply fuzzy offset if requested
  6. Assign unique color
  7. Create participant in DB
  8. Return participant entity (MEC computed on read)
```

**Fuzzy Location:**
- [ ] Offset range: 0.5-1 mile (~800-1600 meters)
- [ ] Random angle (0-360°) + random distance within range
- [ ] Apply offset to geocoded lat/lng
- [ ] Consider: deterministic offset per participant (hash-based) for idempotence

**Color Assignment:**
- [ ] Predefined palette (12-16 colors)
- [ ] Query existing participants for event → get used colors
- [ ] Assign first unused color from palette
- [ ] If palette exhausted → cycle or use hash-based color
- [ ] Handle race condition: optimistic create with retry on color conflict, or use DB sequence

**Color Palette Example:**
```typescript
const PARTICIPANT_COLORS = [
  'coral', 'teal', 'gold', 'orchid', 'lime',
  'salmon', 'cyan', 'amber', 'violet', 'mint',
  'rose', 'sky', 'orange', 'indigo', 'emerald', 'pink'
];
```

**Update Participant:**
- [ ] Check event not published
- [ ] If address changed → re-geocode
- [ ] If fuzzyLocation changed → re-apply or remove offset
- [ ] MEC recomputed on next read

**Delete Participant:**
- [ ] Check event not published
- [ ] Delete from DB (cascade deletes votes)
- [ ] MEC recomputed on next read

---

### 3.5 Input Validation (Request Schemas)

Location: `src/schemas/participant.ts`

**AddParticipantSchema:**
```typescript
z.object({
  name: z.string().min(1).max(50).trim(),
  address: z.string().min(1).max(255).trim(),
  fuzzyLocation: z.boolean().optional().default(false),
}).strict()  // Reject extra fields (no lat/lng sneaking in)
```

**UpdateParticipantSchema:**
```typescript
z.object({
  name: z.string().min(1).max(50).trim().optional(),
  address: z.string().min(1).max(255).trim().optional(),
  fuzzyLocation: z.boolean().optional(),
}).strict().refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field required" }
)
```

**ParticipantIdSchema:**
```typescript
z.object({
  participantId: z.uuid(),
})
```

---

### 3.6 Participant Routes

Location: `src/routes/participants.ts`

**Endpoints:**

```
POST /api/events/:id/participants
  - Validate: EventIdSchema (params) + AddParticipantSchema (body)
  - Call: ParticipantService.addParticipant()
  - Response: 201 + ParticipantResponse

PATCH /api/events/:id/participants/:participantId
  - Validate: EventIdSchema + ParticipantIdSchema (params) + UpdateParticipantSchema (body)
  - Call: ParticipantService.updateParticipant()
  - Response: 200 + ParticipantResponse

DELETE /api/events/:id/participants/:participantId
  - Validate: EventIdSchema + ParticipantIdSchema (params)
  - Call: ParticipantService.deleteParticipant()
  - Response: 200 + DeleteSuccessResponse
```

**Route Registration:**
- [ ] Register in `src/server.ts`
- [ ] Prefix: `/api/events/:id/participants`

---

### 3.7 MEC Integration in EventService

Location: `src/services/event.ts` (modify existing)

**On getEvent():**
- [ ] After fetching event with participants
- [ ] Call `calculateMEC(participants)`
- [ ] Attach result to response (via mapper)

**Mapper Update** (`src/mappers/event.mapper.ts`):
- [ ] `toMECResponse()` - currently returns null, update to use MEC module
- [ ] Compute MEC from participant coordinates in `toEventResponse()`

---

## API Contracts

### Add Participant
```
POST /api/events/:id/participants
Body: {
  "name": "Alice",
  "address": "123 Main St, New York, NY",
  "fuzzyLocation": false
}
Response 201: {
  "id": "uuid",
  "name": "Alice",
  "address": "123 Main St, New York, NY",
  "location": { "lat": 40.7128, "lng": -74.0060 },
  "color": "coral",
  "fuzzyLocation": false
}
```

### Update Participant
```
PATCH /api/events/:id/participants/:participantId
Body: { "name": "Alice Smith" }
Response 200: { ...updated participant }
```

### Delete Participant
```
DELETE /api/events/:id/participants/:participantId
Response 200: { "success": true, "message": "Participant removed successfully" }
```

### Get Event (with MEC)
```
GET /api/events/:id
Response 200: {
  "id": "evt_...",
  "title": "Friday Dinner",
  "participants": [...],
  "mec": {
    "center": { "lat": 40.7128, "lng": -74.0060 },
    "radiusMeters": 5000
  }
}
```

---

## Testing

### Unit Tests

**MEC Algorithm** (`tests/unit/mec.test.ts`):
| Test Case | Input | Expected |
|-----------|-------|----------|
| Empty array | [] | null |
| Single point | [(40.7, -74.0)] | center=(40.7, -74.0), radius=0 |
| Two points | [(0, 0), (0, 2)] | center=(0, 1), radius≈111km |
| Equilateral triangle | 3 points | Known enclosing circle |
| Collinear points | 3 points on line | Correct enclosing circle |
| Square | 4 corners | Circle through diagonal |

**Maps Service** (`tests/unit/maps.test.ts`):
- [ ] Successful geocode (mocked Google response)
- [ ] Address not found (mocked empty response)
- [ ] Cache hit (no API call)
- [ ] Cache miss (API called, result cached)
- [ ] Redis failure (proceeds without cache)
- [ ] Google API timeout (throws ExternalServiceError)
- [ ] Retry on 5xx (mocked retry scenario)

### Integration Tests

**Participant Flow** (`tests/integration/participants.test.ts`):
| Test | Method | Expected |
|------|--------|----------|
| Add participant | POST | 201, geocoded location, color assigned |
| Add with fuzzy | POST fuzzyLocation=true | 201, location offset from actual |
| Invalid address | POST "asdfghjkl123" | 400 ADDRESS_NOT_FOUND |
| Add to published | POST after publish | 409 EVENT_ALREADY_PUBLISHED |
| Update name | PATCH | 200, name changed, location same |
| Update address | PATCH | 200, re-geocoded location |
| Delete participant | DELETE | 200, participant removed |
| Delete from published | DELETE after publish | 409 EVENT_ALREADY_PUBLISHED |
| Event not found | POST to bad eventId | 404 EVENT_NOT_FOUND |
| Participant not found | PATCH bad participantId | 404 PARTICIPANT_NOT_FOUND |

**MEC via Event** (`tests/integration/events.test.ts` - extend):
| Test | Setup | Expected MEC |
|------|-------|--------------|
| 0 participants | New event | mec: null |
| 1 participant | Add 1 | mec.center = participant location |
| 3 participants | Add 3 | Valid enclosing circle |
| After delete | Delete 1 of 3 | MEC recomputed |

### Test Infrastructure
- [ ] Mock Google Maps API (don't hit real API in CI)
- [ ] Mock Redis (or use test Redis instance)
- [ ] Deterministic fixtures for geocode responses
- [ ] Test database with cleanup between tests

---

## Dependencies

- [x] Milestone 2 (Event Module) - COMPLETED
- [ ] Google Maps API key configured (`GOOGLE_MAPS_API_KEY`)
- [ ] Redis running (already setup in MS1)

---

## Exit Criteria

- [ ] MEC algorithm passes all unit tests
- [ ] Geocoding works with Redis caching (30-day TTL)
- [ ] Geocoding handles errors gracefully (address not found, timeout, API failure)
- [ ] All 3 Participant endpoints working (POST, PATCH, DELETE)
- [ ] Colors assigned without duplicates (until palette exhausted)
- [ ] Fuzzy location applies ~0.5-1 mile offset
- [ ] Published events reject participant changes (409)
- [ ] No frontend lat/lng accepted (strict schema validation)
- [ ] Unit tests for MEC algorithm
- [ ] Integration tests for participant flow (with mocked Maps API)
- [ ] All tests pass in CI without hitting Google API

---

## Implementation Order (Recommended)

1. **MEC Module** - Pure algorithm, no external deps, easy to unit test
2. **Maps Service** - Geocoding with cache, mock-friendly design
3. **Participant Repository** - Data access layer
4. **Participant Schemas** - Input validation
5. **Participant Service** - Business logic orchestration
6. **Participant Routes** - Wire everything together
7. **MEC Integration** - Update EventService/mapper
8. **Integration Tests** - End-to-end participant flow

---

## Files to Create/Modify

### New Files
- `src/lib/mec.ts` - MEC algorithm
- `src/lib/maps.ts` - Google Geocoding service
- `src/repositories/participant.ts` - Participant data access
- `src/services/participant.ts` - Participant business logic
- `src/schemas/participant.ts` - Request validation schemas
- `src/routes/participants.ts` - API endpoints
- `tests/unit/mec.test.ts` - MEC unit tests
- `tests/unit/maps.test.ts` - Maps service unit tests
- `tests/integration/participants.test.ts` - Participant API tests

### Modified Files
- `src/lib/config.ts` - Add GOOGLE_MAPS_API_KEY, cache TTL config
- `src/mappers/event.mapper.ts` - Update toMECResponse() to compute MEC
- `src/server.ts` - Register participant routes
- `tests/integration/events.test.ts` - Add MEC tests
