# Frontend API Testing Guide

Quick reference for testing against the Where2Meet backend API.

**Base URL**: `http://localhost:3000`

---

## Current Status (Milestone 2 Complete)

### Available Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | No | Liveness check |
| GET | `/health/ready` | No | Readiness check (DB + Redis) |
| POST | `/api/events` | No | Create event |
| GET | `/api/events/:id` | No | Get event details |
| PATCH | `/api/events/:id` | Yes | Update event |
| DELETE | `/api/events/:id` | Yes | Delete event |

---

## Quick Start

### 1. Start the Server

```bash
# Option A: Use the start script (recommended)
./start.sh

# Option B: Manual steps
docker-compose up -d
npx prisma migrate dev
npm run dev
```

### 2. Verify Server is Running

```bash
curl http://localhost:3000/health
# → { "status": "ok" }
```

---

## Event API

### Create Event

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"title": "Team Lunch"}'
```

**Response (201):**
```json
{
  "id": "evt_1734001234567_aB3xK9mPqR7sNz2w",
  "title": "Team Lunch",
  "meetingTime": null,
  "participants": [],
  "mec": null,
  "publishedVenueId": null,
  "publishedAt": null,
  "createdAt": "2025-12-12T10:00:00.000Z",
  "updatedAt": "2025-12-12T10:00:00.000Z",
  "settings": {
    "allowParticipantsAfterPublish": false
  },
  "participantToken": "pt_a1b2c3d4e5f6...64chars",
  "organizerParticipantId": "uuid-of-organizer-participant"
}
```

**IMPORTANT**: Save the `participantToken` - it's only returned once on creation!

### Create Event with Meeting Time

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Lunch",
    "meetingTime": "2025-01-15T12:00:00Z"
  }'
```

### Get Event

```bash
curl http://localhost:3000/api/events/{EVENT_ID}
```

**Response (200):**
```json
{
  "id": "evt_1734001234567_aB3xK9mPqR7sNz2w",
  "title": "Team Lunch",
  "meetingTime": null,
  "participants": [],
  "mec": null,
  "publishedVenueId": null,
  "publishedAt": null,
  "createdAt": "2025-12-12T10:00:00.000Z",
  "updatedAt": "2025-12-12T10:00:00.000Z",
  "settings": {
    "allowParticipantsAfterPublish": false
  }
}
```

Note: `participantToken` is NOT included in GET responses.

### Update Event (Requires Auth)

```bash
curl -X PATCH http://localhost:3000/api/events/{EVENT_ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {ORGANIZER_TOKEN}" \
  -d '{"title": "Updated Title"}'
```

**Response (200):** Updated event object (same shape as GET)

### Delete Event (Requires Auth)

```bash
curl -X DELETE http://localhost:3000/api/events/{EVENT_ID} \
  -H "Authorization: Bearer {ORGANIZER_TOKEN}"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed"
}
```

### Unauthorized (401)
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Authorization header required"
}
```

### Forbidden (403)
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Invalid organizer token"
}
```

### Not Found (404)
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Event not found"
}
```

---

## TypeScript Types

```typescript
// Event Response (GET /api/events/:id)
interface EventResponse {
  id: string;                    // Semantic ID: evt_<timestamp>_<random16>
  title: string;
  meetingTime: string | null;    // ISO 8601
  participants: ParticipantResponse[];
  mec: MECResponse | null;
  publishedVenueId: string | null;
  publishedAt: string | null;    // ISO 8601
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  settings: {
    allowParticipantsAfterPublish: boolean;
  };
}

// Create Event Response (POST /api/events)
interface CreateEventResponse extends EventResponse {
  participantToken: string;         // Token for auth (SAVE THIS!)
  organizerParticipantId: string;   // UUID of organizer participant
}

// Participant (future milestone)
interface ParticipantResponse {
  id: string;
  name: string;
  color: string;
  location: LocationResponse | null;  // null if fuzzy
}

// Location
interface LocationResponse {
  lat: number;
  lng: number;
}

// MEC (Minimum Enclosing Circle)
interface MECResponse {
  center: LocationResponse;
  radiusMeters: number;
}

// Delete Response
interface DeleteSuccessResponse {
  success: true;
  message: string;
}
```

---

## Test Scenarios

### Happy Path Flow

1. **Create Event** → Save `participantToken` and `id`
2. **Get Event** → Verify event exists
3. **Update Event** → Change title with auth
4. **Get Event** → Verify title changed
5. **Delete Event** → Remove event with auth
6. **Get Event** → Verify 404

### Auth Testing

| Scenario | Expected |
|----------|----------|
| PATCH without Authorization header | 401 |
| PATCH with invalid token | 403 |
| PATCH with valid token | 200 |
| DELETE without Authorization header | 401 |
| DELETE with wrong event's token | 403 |
| DELETE with valid token | 200 |

### Validation Testing

| Input | Expected |
|-------|----------|
| Empty body on POST | 400 |
| `title: ""` (empty string) | 400 |
| `title: "x".repeat(101)` (>100 chars) | 400 |
| Invalid event ID format (not `evt_...`) | 400 |
| Non-existent event ID | 404 |

---

## Coming Soon (Future Milestones)

### Milestone 3: Participant Module
- `POST /api/events/:id/participants` - Join event
- `GET /api/events/:id/participants` - List participants
- `PATCH /api/participants/:id` - Update location
- `DELETE /api/participants/:id` - Leave event

### Milestone 4: Venue Module
- `GET /api/events/:id/venues` - Search venues (Google Places)
- Venue caching

### Milestone 5: Voting Module
- `POST /api/events/:id/votes` - Cast vote
- `DELETE /api/votes/:id` - Remove vote
- `POST /api/events/:id/publish` - Publish final venue

---

## Notes

- All timestamps are ISO 8601 format
- Event IDs use semantic format: `evt_<timestamp>_<random16>` (e.g., `evt_1734001234567_aB3xK9mPqR7sNz2w`)
- `participantToken` format: `pt_<64 hex chars>`
- Participants array is empty until Milestone 3
- `mec` (minimum enclosing circle) is calculated when participants have locations
