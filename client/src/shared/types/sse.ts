import * as v from '@/shared/lib/schema';
import type { SSEMessage } from '@/shared/lib/sse-parser';

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

export type ParsedSSEEvent =
  | { kind: 'event'; event: SSEEventData }
  | { kind: 'ignored' }
  | { kind: 'invalid'; reason: string };

export function parseSSEEvent(message: SSEMessage, eventId: string): ParsedSSEEvent {
  if (!isSSEEventType(message.event)) return { kind: 'ignored' };
  try {
    const payload = sseEventSchemas[message.event](JSON.parse(message.data), '');
    const event = { type: message.event, data: { ...payload, eventId } } as SSEEventData;
    return { kind: 'event', event };
  } catch (error) {
    return { kind: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  }
}

// Connection states for SSE
export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
