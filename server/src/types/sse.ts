/**
 * SSE (Server-Sent Events) type definitions.
 *
 * Defines event types, payloads, and connection management interfaces.
 * @module types/sse
 */

import type { FastifyReply } from "fastify";

/**
 * SSE event types that can be broadcast to clients.
 */
export type SSEEventType =
  | "participant:added"
  | "participant:updated"
  | "participant:removed"
  | "vote:statistics"
  | "vote:changed"
  | "event:updated"
  | "event:published"
  | "heartbeat";

/**
 * Payload for participant:added event.
 */
export interface ParticipantAddedPayload {
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

/**
 * Payload for participant:updated event.
 */
export interface ParticipantUpdatedPayload {
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

/**
 * Payload for participant:removed event.
 */
export interface ParticipantRemovedPayload {
  participantId: string;
}

/**
 * Payload for vote:statistics event (full snapshot).
 * Enhanced with sequence tracking and properly named voterIds field.
 */
export interface VoteStatisticsPayload {
  eventId: string; // Event ID for synchronization
  seq: number; // Sequence number for ordering
  venues: {
    venueId: string;
    voteCount: number;
    voterIds: string[]; // Participant UUIDs who voted (correct naming)
    voterNames?: string[]; // DEPRECATED: Use voterIds instead (kept for backward compatibility)
  }[];
  totalVotes: number;
  updatedAt: string; // ISO timestamp when snapshot was generated
}

/**
 * Payload for vote:changed event (incremental update).
 * Sent when a single vote is cast or removed for efficiency.
 */
export interface VoteChangedPayload {
  eventId: string; // Event ID for synchronization
  seq: number; // Sequence number for ordering
  venueId: string; // Venue that was voted for/unvoted
  voterId: string; // Participant UUID who cast/removed the vote
  delta: 1 | -1; // +1 for vote cast, -1 for vote removed
  voteCount: number; // New total vote count for this venue
  totalVotes: number; // New total votes across all venues
  updatedAt: string; // ISO timestamp when change occurred
}

/**
 * Payload for event:updated event.
 */
export interface EventUpdatedPayload {
  event: {
    id: string;
    title: string;
    meetingTime: string | null;
    publishedAt: string | null;
    publishedVenueId: string | null;
  };
}

/**
 * Payload for event:published event.
 */
export interface EventPublishedPayload {
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

/**
 * Payload for heartbeat event.
 */
export interface HeartbeatPayload {
  timestamp: string;
}

/**
 * Union type of all SSE event payloads.
 */
export type SSEPayload =
  | ParticipantAddedPayload
  | ParticipantUpdatedPayload
  | ParticipantRemovedPayload
  | VoteStatisticsPayload
  | VoteChangedPayload
  | EventUpdatedPayload
  | EventPublishedPayload
  | HeartbeatPayload;

/**
 * Represents an active SSE connection.
 */
export interface SSEConnection {
  /** Unique connection ID */
  id: string;
  /** Event ID this connection is subscribed to */
  eventId: string;
  /** Fastify reply object for sending events */
  reply: FastifyReply;
  /** Timestamp when connection was established */
  connectedAt: Date;
  /** Participant ID if authenticated as participant */
  participantId?: string;
  /** Whether this is an organizer connection */
  isOrganizer: boolean;
}

/**
 * Options for broadcasting an SSE event.
 */
export interface BroadcastOptions {
  /** Event ID to broadcast to */
  eventId: string;
  /** Event type */
  type: SSEEventType;
  /** Event payload data */
  payload: SSEPayload;
}
