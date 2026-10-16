import * as v from '@/shared/lib/schema';
import type { SSEMessage } from '@/shared/lib/sse-parser';

// Mirrors server/src/types/sse.ts and the broadcasts in server/src/routes. The server sends
// heartbeat, close and vote:changed too; the client has no use for them, so it ignores them.
// vote:statistics follows every vote:changed with the full snapshot.
const participant = v.object({
  id: v.string,
  name: v.string,
  address: v.nullable(v.string),
  lat: v.nullable(v.number),
  lng: v.nullable(v.number),
  color: v.string,
  isOrganizer: v.boolean,
});

const sseEventSchemas = {
  'event:updated': v.object({
    event: v.object({
      id: v.string,
      title: v.string,
      meetingTime: v.nullable(v.string),
      publishedAt: v.nullable(v.string),
      publishedVenueId: v.nullable(v.string),
    }),
  }),
  'event:published': v.object({
    event: v.object({
      id: v.string,
      title: v.string,
      meetingTime: v.nullable(v.string),
      publishedAt: v.string,
      publishedVenueId: v.string,
    }),
    venue: v.object({
      id: v.string,
      name: v.string,
      address: v.nullable(v.string),
      lat: v.number,
      lng: v.number,
    }),
  }),
  'participant:added': v.object({ participant }),
  'participant:updated': v.object({ participant }),
  'participant:removed': v.object({ participantId: v.string }),
  'vote:statistics': v.object({
    eventId: v.string,
    seq: v.number,
    venues: v.array(
      v.object({ venueId: v.string, voteCount: v.number, voterIds: v.array(v.string) })
    ),
    totalVotes: v.number,
    updatedAt: v.string,
  }),
};

type SSEEventSchemas = typeof sseEventSchemas;
export type SSEEventType = keyof SSEEventSchemas;

// useEventStream adds the connection's eventId to every payload.
export type SSEEventData = {
  [K in SSEEventType]: { type: K; data: v.Infer<SSEEventSchemas[K]> & { eventId: string } };
}[SSEEventType];

type SSEPayload<K extends SSEEventType> = Extract<SSEEventData, { type: K }>['data'];
export type EventUpdatedPayload = SSEPayload<'event:updated'>;
export type EventPublishedPayload = SSEPayload<'event:published'>;
export type ParticipantAddedPayload = SSEPayload<'participant:added'>;
export type ParticipantUpdatedPayload = SSEPayload<'participant:updated'>;
export type ParticipantRemovedPayload = SSEPayload<'participant:removed'>;
export type VoteStatisticsPayload = SSEPayload<'vote:statistics'>;
export type SSEParticipant = v.Infer<typeof participant>;

function isSSEEventType(type: string): type is SSEEventType {
  return Object.hasOwn(sseEventSchemas, type);
}

// Returns null for an event the client ignores. Throws when the data is not JSON or
// does not match the event's schema.
export function parseSSEEvent(message: SSEMessage, eventId: string): SSEEventData | null {
  if (!isSSEEventType(message.event)) return null;
  const payload = sseEventSchemas[message.event](JSON.parse(message.data), '');
  return { type: message.event, data: { eventId, ...payload } } as SSEEventData;
}

// Connection states for SSE
export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
