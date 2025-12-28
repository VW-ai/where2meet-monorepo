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
  eventId: string;
  title?: string;
  meetingTime?: string | null;
  updatedAt: string;
}

export interface EventPublishedPayload {
  eventId: string;
  publishedVenueId: string;
  publishedAt: string;
  venue: {
    id: string;
    name: string;
    address: string;
    location: { lat: number; lng: number };
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
  venues: Array<{
    venueId: string;
    voteCount: number;
    voterNames: string[]; // Backend sends "voterNames" but it contains participant IDs
  }>;
  totalVotes: number;
}

export interface VoteChangedPayload {
  eventId: string;
  seq: number;
  venueId: string;
  voterNames: string[]; // Participant IDs who voted
  voteCount: number;
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
