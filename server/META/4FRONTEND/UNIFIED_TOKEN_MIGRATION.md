# Frontend Migration Guide: Unified Token System

This guide documents the breaking changes in the backend's unified token system and how to migrate the frontend.

## Overview

The backend now uses a **unified token system** where both organizers and participants use the same token format (`participantToken`). The old `organizerToken` field has been removed.

## Breaking Changes

### 1. API Response Field Rename (BREAKING)

When creating an event, the response now returns `participantToken` instead of `organizerToken`.

**Before:**
```typescript
interface CreateEventResponse {
  id: string;
  organizerToken: string;        // OLD - REMOVED
  organizerParticipantId: string;
  title: string;
  meetingTime: string | null;
  // ...
}
```

**After:**
```typescript
interface CreateEventResponse {
  id: string;
  participantToken: string;      // NEW - use this
  organizerParticipantId: string;
  title: string;
  meetingTime: string | null;
  // ...
}
```

### 2. Token Storage Update

Update your token storage code to use the new field name:

```typescript
// BEFORE
const { organizerToken, organizerParticipantId } = await createEvent(data);
localStorage.setItem('organizerToken', organizerToken);
localStorage.setItem('participantId', organizerParticipantId);

// AFTER
const { participantToken, organizerParticipantId } = await createEvent(data);
localStorage.setItem('token', participantToken);  // Unified naming
localStorage.setItem('participantId', organizerParticipantId);
```

### 3. No Auth Header Changes

The `Authorization` header format remains unchanged:

```typescript
// UNCHANGED - Both organizers and participants use same header format
fetch('/api/events/:id', {
  headers: {
    'Authorization': `Bearer ${token}`  // Works for both roles
  }
});
```

## New Features

### New `/me` Endpoint for Role Detection

Use `GET /api/events/:id/me` to determine the authenticated user's role after page refresh:

```typescript
// Request
GET /api/events/{eventId}/me
Authorization: Bearer {token}

// Response
{
  "participantId": "uuid",
  "name": "Alice",
  "isOrganizer": true,    // Use this to show/hide organizer controls
  "color": "#FF5733",
  "address": "123 Main St" | null,
  "lat": 40.7128 | null,
  "lng": -74.006 | null
}
```

**Use cases:**
1. Show/hide organizer-only controls based on `isOrganizer`
2. Get the current user's participant ID for vote endpoints
3. Restore user identity after page refresh (token stored, need to know who they are)

### New SSE Vote Events (Optional Enhancement)

The SSE vote system now includes enhanced events:

**vote:changed (New - Incremental update)**
```typescript
interface VoteChangedPayload {
  eventId: string;
  seq: number;           // Monotonic sequence for ordering
  venueId: string;       // Which venue changed
  voterId: string;       // Who voted (participant UUID)
  delta: 1 | -1;         // Vote added (+1) or removed (-1)
  voteCount: number;     // New count for this venue
  totalVotes: number;    // New total across all venues
  updatedAt: string;     // ISO timestamp
}
```

**vote:statistics (Enhanced - Full snapshot)**
```typescript
interface VoteStatisticsPayload {
  eventId: string;
  seq: number;
  venues: {
    venueId: string;
    voteCount: number;
    voterIds: string[];      // Participant UUIDs who voted
    voterNames?: string[];   // DEPRECATED: Will be removed
  }[];
  totalVotes: number;
  updatedAt: string;
}
```

**Client reconnection strategy:**
1. Client connects and receives events with `seq` numbers
2. Client detects gap in sequence (e.g., expected 42, received 45)
3. Client fetches snapshot: `GET /api/events/:id/votes/statistics`
4. Snapshot includes current `seq` - client resynchronized

## Migration Checklist

- [ ] Update `createEvent()` response handling: `organizerToken` to `participantToken`
- [ ] Update token storage key naming (optional: `organizerToken` to `token`)
- [ ] Add `/me` endpoint call after page refresh to restore role
- [ ] Optionally handle `vote:changed` SSE event for incremental updates
- [ ] Test both organizer and participant flows work with unified token

## Backward Compatibility

- `Authorization` header format unchanged
- Token value format unchanged (`pt_<hex>`)
- All existing endpoints work the same way
- SSE `vote:statistics` still broadcast (clients can ignore `vote:changed`)
