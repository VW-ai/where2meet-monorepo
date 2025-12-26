# SSE Integration Guide

Real-time updates via Server-Sent Events for Where2Meet.

**Endpoint**: `GET /api/events/:id/stream`

---

## Quick Start

### 1. Connect to SSE Stream

```typescript
// Using EventSource polyfill (recommended for custom headers)
import { EventSourcePolyfill } from 'event-source-polyfill';

const eventId = 'evt_1734001234567_aB3xK9mPqR7sNz2w';
const token = 'your_participant_token'; // from event creation or self-registration

const eventSource = new EventSourcePolyfill(
  `http://localhost:3000/api/events/${eventId}/stream`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

// Listen for events
eventSource.addEventListener('participant:added', (e) => {
  const data = JSON.parse(e.data);
  console.log('New participant:', data.participant);
});

eventSource.addEventListener('participant:updated', (e) => {
  const data = JSON.parse(e.data);
  console.log('Participant updated:', data.participant);
});

eventSource.addEventListener('heartbeat', (e) => {
  console.log('Connection alive:', JSON.parse(e.data).timestamp);
});

// Handle errors
eventSource.onerror = (e) => {
  console.error('SSE error:', e);
  eventSource.close();
};
```

### 2. Install Polyfill

```bash
npm install event-source-polyfill
```

> **Why polyfill?** Native `EventSource` doesn't support custom headers. We require `Authorization` header for authentication.

---

## Authentication

| Who | Token Source | How to Get |
|-----|--------------|------------|
| Organizer | `participantToken` from `POST /api/events` response | Create an event |
| Participant | `participantToken` from `POST /api/events/:id/participants` response | Self-register to event |

```bash
# Test connection with curl
curl -N -H "Authorization: Bearer {token}" \
  "http://localhost:3000/api/events/{eventId}/stream"
```

---

## Event Types

### `participant:added`

Fired when a new participant joins the event.

```typescript
interface ParticipantAddedEvent {
  participant: {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    color: string;
    isOrganizer: boolean;
  };
}
```

### `participant:updated`

Fired when a participant updates their info (name, address, location).

```typescript
interface ParticipantUpdatedEvent {
  participant: {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    color: string;
    isOrganizer: boolean;
  };
}
```

### `participant:removed`

Fired when a participant leaves or is removed.

```typescript
interface ParticipantRemovedEvent {
  participantId: string;
}
```

### `vote:statistics`

Fired when voting changes (vote cast or removed).

```typescript
interface VoteStatisticsEvent {
  venues: {
    venueId: string;
    voteCount: number;
    voterNames: string[];
  }[];
  totalVotes: number;
}
```

### `event:updated`

Fired when event details change (title, meetingTime).

```typescript
interface EventUpdatedEvent {
  event: {
    id: string;
    title: string;
    meetingTime: string | null;
    publishedAt: string | null;
    publishedVenueId: string | null;
  };
}
```

### `event:published`

Fired when organizer publishes the final venue.

```typescript
interface EventPublishedEvent {
  event: {
    id: string;
    title: string;
    meetingTime: string | null;
    publishedAt: string;
    publishedVenueId: string;
  };
  venue: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
}
```

### `heartbeat`

Sent every 30 seconds to keep connection alive.

```typescript
interface HeartbeatEvent {
  timestamp: string; // ISO 8601
}
```

---

## React Hook Example

```typescript
import { useEffect, useCallback } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

type SSEEventType =
  | 'participant:added'
  | 'participant:updated'
  | 'participant:removed'
  | 'vote:statistics'
  | 'event:updated'
  | 'event:published';

interface UseEventStreamOptions {
  eventId: string;
  token: string;
  onParticipantAdded?: (data: ParticipantAddedEvent) => void;
  onParticipantUpdated?: (data: ParticipantUpdatedEvent) => void;
  onParticipantRemoved?: (data: ParticipantRemovedEvent) => void;
  onVoteStatistics?: (data: VoteStatisticsEvent) => void;
  onEventUpdated?: (data: EventUpdatedEvent) => void;
  onEventPublished?: (data: EventPublishedEvent) => void;
  onError?: (error: Event) => void;
}

export function useEventStream({
  eventId,
  token,
  onParticipantAdded,
  onParticipantUpdated,
  onParticipantRemoved,
  onVoteStatistics,
  onEventUpdated,
  onEventPublished,
  onError,
}: UseEventStreamOptions) {
  useEffect(() => {
    if (!eventId || !token) return;

    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    const eventSource = new EventSourcePolyfill(
      `${baseUrl}/api/events/${eventId}/stream`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    // Register event listeners
    if (onParticipantAdded) {
      eventSource.addEventListener('participant:added', (e: MessageEvent) => {
        onParticipantAdded(JSON.parse(e.data));
      });
    }

    if (onParticipantUpdated) {
      eventSource.addEventListener('participant:updated', (e: MessageEvent) => {
        onParticipantUpdated(JSON.parse(e.data));
      });
    }

    if (onParticipantRemoved) {
      eventSource.addEventListener('participant:removed', (e: MessageEvent) => {
        onParticipantRemoved(JSON.parse(e.data));
      });
    }

    if (onVoteStatistics) {
      eventSource.addEventListener('vote:statistics', (e: MessageEvent) => {
        onVoteStatistics(JSON.parse(e.data));
      });
    }

    if (onEventUpdated) {
      eventSource.addEventListener('event:updated', (e: MessageEvent) => {
        onEventUpdated(JSON.parse(e.data));
      });
    }

    if (onEventPublished) {
      eventSource.addEventListener('event:published', (e: MessageEvent) => {
        onEventPublished(JSON.parse(e.data));
      });
    }

    eventSource.onerror = (e) => {
      console.error('SSE connection error:', e);
      onError?.(e);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [eventId, token]);
}
```

### Usage in Component

```tsx
function EventPage({ eventId, token }) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEventStream({
    eventId,
    token,
    onParticipantAdded: (data) => {
      setParticipants(prev => [...prev, data.participant]);
    },
    onParticipantUpdated: (data) => {
      setParticipants(prev =>
        prev.map(p => p.id === data.participant.id ? data.participant : p)
      );
    },
    onParticipantRemoved: (data) => {
      setParticipants(prev =>
        prev.filter(p => p.id !== data.participantId)
      );
    },
    onError: () => {
      // Handle reconnection or show error
    }
  });

  return (
    <div>
      {participants.map(p => (
        <ParticipantCard key={p.id} participant={p} />
      ))}
    </div>
  );
}
```

---

## Error Handling

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid event ID format |
| 401 | `UNAUTHORIZED` | Missing Authorization header |
| 403 | `FORBIDDEN` | Invalid token or token doesn't belong to this event |
| 404 | `EVENT_NOT_FOUND` | Event doesn't exist |

### Reconnection Strategy

```typescript
function createReconnectingEventSource(url: string, token: string) {
  let eventSource: EventSourcePolyfill | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  function connect() {
    eventSource = new EventSourcePolyfill(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    eventSource.onopen = () => {
      reconnectAttempts = 0; // Reset on successful connection
    };

    eventSource.onerror = () => {
      eventSource?.close();

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Reconnecting... attempt ${reconnectAttempts}`);
        setTimeout(connect, reconnectDelay * reconnectAttempts);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };

    return eventSource;
  }

  return connect();
}
```

---

## Testing with curl

```bash
# 1. Create event and get token
EVENT=$(curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Event"}')

EVENT_ID=$(echo $EVENT | jq -r '.id')
TOKEN=$(echo $EVENT | jq -r '.participantToken')

# 2. Connect to SSE stream (keep terminal open)
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/events/$EVENT_ID/stream"

# 3. In another terminal, add a participant to trigger event
curl -X POST "http://localhost:3000/api/events/$EVENT_ID/participants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "address": "123 Main St"}'

# You should see `participant:added` event in the first terminal
```

---

## Notes

- **Heartbeat**: Server sends heartbeat every 30 seconds. If you don't receive one within ~60s, connection may be dead.
- **CORS**: SSE endpoint includes CORS headers for cross-origin requests.
- **Proxy**: If behind nginx, ensure `X-Accel-Buffering: no` header is respected (server already sends it).
- **Mobile**: Consider using fetch-based SSE for better mobile browser support.
