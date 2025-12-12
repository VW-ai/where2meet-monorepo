# Milestone 2: Event Module

Core event CRUD operations with organizer authentication.

---

## Deliverables

### 2.1 Event Routes
- [ ] `POST /api/events` - Create event
- [ ] `GET /api/events/:id` - Get event details
- [ ] `PATCH /api/events/:id` - Update event (requires token)
- [ ] `DELETE /api/events/:id` - Delete event (requires token)

### 2.2 Event Service
- [ ] Generate UUID for event ID
- [ ] Generate secure organizerToken (64 chars)
- [ ] Validate organizer token for protected operations
- [ ] Return organizerToken only on creation

### 2.3 Event Repository
- [ ] Create event in database
- [ ] Find event by ID
- [ ] Update event fields
- [ ] Delete event (cascade to participants)

### 2.4 Input Validation (Zod)
- [ ] CreateEventSchema: `{ title: string, meetingTime?: string }`
- [ ] UpdateEventSchema: `{ title?: string, meetingTime?: string }`
- [ ] Validate UUID format for event ID

### 2.5 Auth Middleware
- [ ] Extract token from `Authorization: Bearer {token}`
- [ ] Verify token matches event's organizerToken
- [ ] Return 401/403 appropriately

---

## API Contracts

### Create Event
```
POST /api/events
Body: { "title": "Team Lunch", "meetingTime": "2024-01-15T12:00:00Z" }
Response 201: { "id": "uuid", "title": "...", "organizerToken": "..." }
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

- [ ] All 4 Event endpoints working
- [ ] Token auth protects PATCH/DELETE
- [ ] Zod validation rejects bad input
- [ ] Unit tests for EventService
- [ ] Integration tests for all endpoints
