# Where2Meet API Guide for Frontend Developers

This guide explains how to integrate with the Where2Meet backend API.

---

## Quick Start

**Base URL:** `http://localhost:3000` (development)

**Content-Type:** All requests use `application/json`

**Authentication:** Bearer tokens in the `Authorization` header

```typescript
// Example: Authenticated request
fetch('/api/events/evt_123/participants/uuid', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`, // organizerToken or participantToken
  },
  body: JSON.stringify({ name: 'New Name' }),
});
```

---

## Token Types

There are two token types:

| Token              | Format              | Received When   | Can Do                                         |
| ------------------ | ------------------- | --------------- | ---------------------------------------------- |
| `organizerToken`   | `ot_<64 hex chars>` | Create event    | Full control over event and all participants   |
| `participantToken` | `pt_<64 hex chars>` | Self-join event | Update/delete only your own participant record |

**Important:** Store tokens securely (e.g., `localStorage`). They cannot be recovered if lost.

---

## Event Lifecycle

### 1. Create an Event

```typescript
// POST /api/events
const response = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Friday Lunch',
    meetingTime: '2025-12-20T12:00:00Z', // Optional, ISO 8601
  }),
});

const event = await response.json();
// {
//   id: "evt_1702567890123_aBcDeFgHiJkLmNoP",
//   title: "Friday Lunch",
//   meetingTime: "2025-12-20T12:00:00.000Z",
//   organizerToken: "ot_a1b2c3d4...",  // SAVE THIS! Only returned on create
//   participants: [],
//   mec: null,
//   createdAt: "2025-12-13T10:00:00.000Z",
//   updatedAt: "2025-12-13T10:00:00.000Z"
// }

// Store the organizerToken for future requests
localStorage.setItem(`event_${event.id}_organizer`, event.organizerToken);
```

### 2. View an Event (Public)

```typescript
// GET /api/events/:id
// No authentication required
const response = await fetch(`/api/events/${eventId}`);
const event = await response.json();
// Note: organizerToken is NOT returned here
```

### 3. Update an Event (Organizer Only)

```typescript
// PATCH /api/events/:id
const response = await fetch(`/api/events/${eventId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${organizerToken}`,
  },
  body: JSON.stringify({
    title: 'Friday Lunch at Noon', // Optional
    meetingTime: '2025-12-20T13:00:00Z', // Optional
  }),
});
```

### 4. Delete an Event (Organizer Only)

```typescript
// DELETE /api/events/:id
const response = await fetch(`/api/events/${eventId}`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${organizerToken}`,
  },
});
// { success: true, message: "Event deleted successfully" }
```

---

## Participant Management

### Two Ways to Add Participants

#### Option A: Self-Registration (No Auth)

Users join themselves and receive a `participantToken` for self-management.

```typescript
// POST /api/events/:id/participants (no Authorization header)
const response = await fetch(`/api/events/${eventId}/participants`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Alice',
    address: '123 Main St, San Francisco, CA',
    fuzzyLocation: false, // Optional, default false
  }),
});

const participant = await response.json();
// {
//   id: "550e8400-e29b-41d4-a716-446655440000",
//   name: "Alice",
//   address: "123 Main St, San Francisco, CA",
//   location: { lat: 37.7749, lng: -122.4194 },
//   color: "coral",
//   fuzzyLocation: false,
//   participantToken: "pt_x1y2z3..."  // ONLY returned for self-registration!
// }

// Store for self-management
localStorage.setItem(`participant_${participant.id}`, participant.participantToken);
```

#### Option B: Organizer Adds Participant

Organizer adds someone else (no token returned for that participant).

```typescript
// POST /api/events/:id/participants (with organizerToken)
const response = await fetch(`/api/events/${eventId}/participants`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${organizerToken}`,
  },
  body: JSON.stringify({
    name: 'Bob',
    address: '456 Oak Ave, Oakland, CA',
  }),
});

const participant = await response.json();
// Note: NO participantToken in response (organizer-created)
```

### Update a Participant

Works with either token type:

```typescript
// PATCH /api/events/:id/participants/:participantId

// As organizer (can update anyone)
await fetch(`/api/events/${eventId}/participants/${participantId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${organizerToken}`,
  },
  body: JSON.stringify({ name: 'Alice Smith' }),
});

// As participant (can only update yourself)
await fetch(`/api/events/${eventId}/participants/${myParticipantId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${myParticipantToken}`,
  },
  body: JSON.stringify({
    name: 'Alice Smith',
    address: '789 New St, SF, CA', // Will re-geocode
    fuzzyLocation: true,
  }),
});
```

### Delete a Participant

```typescript
// DELETE /api/events/:id/participants/:participantId

// As organizer (can delete anyone)
await fetch(`/api/events/${eventId}/participants/${participantId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${organizerToken}` },
});

// As participant (leave event - delete yourself)
await fetch(`/api/events/${eventId}/participants/${myParticipantId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${myParticipantToken}` },
});
```

---

## Typical User Flows

### Flow 1: Organizer Creates Event and Adds Friends

```typescript
// 1. Create event
const event = await createEvent({ title: 'Team Lunch' });
saveOrganizerToken(event.id, event.organizerToken);

// 2. Share link with friends: https://where2meet.app/events/{event.id}

// 3. Friends self-register (they store their own participantToken)

// 4. Or organizer adds someone manually:
await addParticipant(event.id, event.organizerToken, {
  name: 'John',
  address: '...',
});
```

### Flow 2: Participant Self-Registration

```typescript
// 1. User clicks shared link, lands on event page
const event = await getEvent(eventId);

// 2. User fills out form and joins
const participant = await fetch(`/api/events/${eventId}/participants`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: userName,
    address: userAddress,
    fuzzyLocation: userWantsFuzzy,
  }),
}).then((r) => r.json());

// 3. Store token for self-management
localStorage.setItem('myParticipantId', participant.id);
localStorage.setItem('myParticipantToken', participant.participantToken);

// 4. Later: user can update or leave
await updateMyself(participant.id, participant.participantToken, { name: 'New Name' });
await leaveEvent(participant.id, participant.participantToken);
```

### Flow 3: Determining User Role

```typescript
function getUserRole(eventId: string): 'organizer' | 'participant' | 'viewer' {
  const organizerToken = localStorage.getItem(`event_${eventId}_organizer`);
  if (organizerToken) return 'organizer';

  const participantToken = localStorage.getItem('myParticipantToken');
  if (participantToken) return 'participant';

  return 'viewer';
}

// Use role to show/hide UI elements
const role = getUserRole(eventId);
if (role === 'organizer') {
  showEditEventButton();
  showDeleteAnyParticipantButton();
} else if (role === 'participant') {
  showEditMyselfButton();
  showLeaveEventButton();
} else {
  showJoinEventForm();
}
```

---

## Error Handling

All errors follow this format:

```typescript
interface ErrorResponse {
  error: {
    code: string; // Machine-readable code
    message: string; // Human-readable message
  };
}
```

### Common Error Codes

| HTTP | Code                      | When                               |
| ---- | ------------------------- | ---------------------------------- |
| 400  | `VALIDATION_ERROR`        | Invalid/missing fields             |
| 400  | `ADDRESS_NOT_FOUND`       | Geocoding failed for address       |
| 401  | `UNAUTHORIZED`            | Missing Authorization header       |
| 403  | `FORBIDDEN`               | Invalid token or wrong permissions |
| 404  | `EVENT_NOT_FOUND`         | Event doesn't exist                |
| 404  | `PARTICIPANT_NOT_FOUND`   | Participant doesn't exist          |
| 409  | `EVENT_ALREADY_PUBLISHED` | Can't modify after publish         |
| 429  | `RATE_LIMIT_EXCEEDED`     | Too many requests                  |

### Error Handling Example

```typescript
async function apiRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const { error } = await response.json();

    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login or clear stored token
        localStorage.removeItem('myParticipantToken');
        showLoginPrompt();
        break;

      case 'FORBIDDEN':
        showError('You do not have permission for this action');
        break;

      case 'ADDRESS_NOT_FOUND':
        showError('Could not find that address. Please try a more specific address.');
        break;

      case 'EVENT_ALREADY_PUBLISHED':
        showError('This event has been finalized and cannot be modified.');
        break;

      default:
        showError(error.message);
    }

    throw new Error(error.code);
  }

  return response.json();
}
```

---

## API Client Example

Here's a simple TypeScript API client:

```typescript
const API_BASE = 'http://localhost:3000';

class Where2MeetAPI {
  // Events
  async createEvent(data: { title: string; meetingTime?: string }) {
    return this.post('/api/events', data);
  }

  async getEvent(eventId: string) {
    return this.get(`/api/events/${eventId}`);
  }

  async updateEvent(
    eventId: string,
    token: string,
    data: { title?: string; meetingTime?: string }
  ) {
    return this.patch(`/api/events/${eventId}`, data, token);
  }

  async deleteEvent(eventId: string, token: string) {
    return this.delete(`/api/events/${eventId}`, token);
  }

  // Participants
  async joinEvent(
    eventId: string,
    data: { name: string; address: string; fuzzyLocation?: boolean }
  ) {
    // Self-registration (no token)
    return this.post(`/api/events/${eventId}/participants`, data);
  }

  async addParticipant(
    eventId: string,
    organizerToken: string,
    data: { name: string; address: string; fuzzyLocation?: boolean }
  ) {
    // Organizer adds participant
    return this.post(`/api/events/${eventId}/participants`, data, organizerToken);
  }

  async updateParticipant(
    eventId: string,
    participantId: string,
    token: string,
    data: { name?: string; address?: string; fuzzyLocation?: boolean }
  ) {
    return this.patch(`/api/events/${eventId}/participants/${participantId}`, data, token);
  }

  async deleteParticipant(eventId: string, participantId: string, token: string) {
    return this.delete(`/api/events/${eventId}/participants/${participantId}`, token);
  }

  // HTTP helpers
  private async get(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    return this.handleResponse(res);
  }

  private async post(path: string, data: object, token?: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  }

  private async patch(path: string, data: object, token: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(token),
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  }

  private async delete(path: string, token: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers(token),
    });
    return this.handleResponse(res);
  }

  private headers(token?: string): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  private async handleResponse(res: Response) {
    const json = await res.json();
    if (!res.ok) throw json.error;
    return json;
  }
}

export const api = new Where2MeetAPI();
```

---

## Response Schemas

### Event Response

```typescript
interface EventResponse {
  id: string; // "evt_1702567890123_aBcDeFgHiJkLmNoP"
  title: string;
  meetingTime: string | null; // ISO 8601
  organizerToken?: string; // Only on create
  participants: ParticipantResponse[];
  mec: MECResponse | null; // Minimum enclosing circle
  publishedVenueId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  settings: {
    maxParticipants: number; // Default 50
    allowSelfRegistration: boolean;
  };
}
```

### Participant Response

```typescript
interface ParticipantResponse {
  id: string; // UUID
  name: string;
  address: string; // Original user input
  location: {
    lat: number;
    lng: number;
  };
  color: string; // e.g., "coral", "teal"
  fuzzyLocation: boolean;
  participantToken?: string; // Only on self-registration
}
```

### MEC Response (Minimum Enclosing Circle)

```typescript
interface MECResponse {
  center: { lat: number; lng: number };
  radius: number; // In meters
}
```

---

## Health Check

```typescript
// Check if API is running
await fetch('/health');
// { status: "ok" }

// Check if all services are ready
await fetch('/health/ready');
// { status: "ok", services: { database: "ok", redis: "ok" } }
```

---

## Notes

1. **Event IDs** use semantic format: `evt_<timestamp>_<random16>`
2. **Fuzzy Location** offsets coordinates by 100-800m for privacy
3. **Geocoding** is done server-side via Google Maps API
4. **Colors** are auto-assigned from a 16-color palette
5. **Published Events** cannot have participants added/modified/removed
