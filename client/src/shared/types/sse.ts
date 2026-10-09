import type { Event } from '@/entities/event/types';
import type { Participant } from '@/entities/participant/types';

// Base SSE event structure
export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id?: string;
  retry?: number;
}

// Event-specific payloads based on backend API specification
export interface EventUpdatedPayload {
  event: Pick<Event, 'id' | 'title' | 'meetingTime' | 'publishedAt' | 'publishedVenueId'>;
}

export interface EventPublishedPayload {
  event: EventUpdatedPayload['event'] & {
    publishedVenueId: string;
    publishedAt: string;
  };
  venue: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
}

export interface ParticipantAddedPayload {
  eventId: string;
  participant: Participant;
}

export interface ParticipantUpdatedPayload {
  eventId: string;
  participantId?: string; // Optional - backend sends participant.id instead
  participant: Participant;
}

export interface ParticipantRemovedPayload {
  eventId: string;
  participantId?: string; // Optional - backend may send in different format
}

export interface VoteStatisticsPayload {
  eventId: string;
  seq: number;
  venues: Array<{
    venueId: string;
    voteCount: number;
    voterIds: string[];
    voterNames?: string[];
  }>;
  totalVotes: number;
  updatedAt: string;
}

export interface VoteChangedPayload {
  eventId: string;
  seq: number;
  venueId: string;
  voterId: string;
  delta: 1 | -1;
  voteCount: number;
  totalVotes: number;
  updatedAt: string;
}

// Discriminated union of all SSE event types
export type SSEEventData =
  | { type: 'event:updated'; data: EventUpdatedPayload }
  | { type: 'event:published'; data: EventPublishedPayload }
  | { type: 'participant:added'; data: ParticipantAddedPayload }
  | { type: 'participant:updated'; data: ParticipantUpdatedPayload }
  | { type: 'participant:removed'; data: ParticipantRemovedPayload }
  | { type: 'vote:changed'; data: VoteChangedPayload }
  | { type: 'vote:statistics'; data: VoteStatisticsPayload };

// Connection states for SSE
export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
