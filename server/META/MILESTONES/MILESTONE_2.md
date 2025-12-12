# Milestone 2: Event Module

Core event CRUD operations with organizer authentication.

**STATUS: COMPLETED** (2025-12-12)

---

## Deliverables

### 2.1 Event Routes
- [x] `POST /api/events` - Create event
- [x] `GET /api/events/:id` - Get event details
- [x] `PATCH /api/events/:id` - Update event (requires token)
- [x] `DELETE /api/events/:id` - Delete event (requires token)

### 2.2 Event Service
- [x] Generate semantic event ID (format: `evt_<timestamp>_<random16>`)
- [x] Generate secure organizerToken (64 chars)
- [x] Validate organizer token for protected operations
- [x] Return organizerToken only on creation

### 2.3 Event Repository
- [x] Create event in database
- [x] Find event by ID
- [x] Update event fields
- [x] Delete event (cascade to participants)

### 2.4 Input Validation (Zod)
- [x] CreateEventSchema: `{ title: string, meetingTime?: string }`
- [x] UpdateEventSchema: `{ title?: string, meetingTime?: string }`
- [x] Validate semantic ID format for event ID (regex pattern)

### 2.5 Auth Middleware
- [x] Extract token from `Authorization: Bearer {token}`
- [x] Verify token matches event's organizerToken
- [x] Return 401/403 appropriately

---

## API Contracts

### Create Event
```
POST /api/events
Body: { "title": "Team Lunch", "meetingTime": "2024-01-15T12:00:00Z" }
Response 201: { "id": "evt_1702000000000_abc...", "title": "...", "organizerToken": "..." }
```

### Get Event
```
GET /api/events/:id
Response 200: { "id": "...", "title": "...", "participants": [], ... }
(No organizerToken in response)
```

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Create event | POST /api/events | 201, returns organizerToken |
| Get event | GET /api/events/:id | 200, no organizerToken |
| Update without token | PATCH /api/events/:id | 401 Unauthorized |
| Update with valid token | PATCH + Bearer token | 200, updated event |
| Delete with valid token | DELETE + Bearer token | 200, event gone |
| Get non-existent | GET /api/events/fake-id | 404 Not Found |

---

## Dependencies

- Milestone 1 (Foundation)

---

## Exit Criteria

- [x] All 4 Event endpoints working
- [x] Token auth protects PATCH/DELETE
- [x] Zod validation rejects bad input
- [x] Unit tests for EventService
- [x] Integration tests for all endpoints

---

## Files Created

| File | Purpose |
|------|---------|
| `src/plugins/db.ts` | Fastify plugin for Prisma dependency injection |
| `src/utils/id.ts` | Semantic ID generation (`evt_<timestamp>_<random16>`) |
| `src/schemas/event.ts` | Zod validation schemas |
| `src/repositories/event.ts` | Database operations (with ID collision retry) |
| `src/services/event.ts` | Business logic |
| `src/hooks/auth.ts` | organizerToken verification |
| `src/routes/events.ts` | API endpoints |
| `tests/utils/id.test.ts` | ID generation tests (11 cases) |
| `tests/events.test.ts` | Integration tests (20 cases) |
| `tests/services/event.test.ts` | Unit tests (14 cases) |
| `docker-compose.yml` | Development database setup |

---

## Note: DTO Refactoring

Current implementation has transformation logic embedded in `EventService`.
The formal DTO/Mapper pattern will be established in **Milestone 3** (section 3.0).

Files to be created in M3:
- `src/types/responses.ts` - Response DTO interfaces
- `src/mappers/event.mapper.ts` - Entity → Response transformation
