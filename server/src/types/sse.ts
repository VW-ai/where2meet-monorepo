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
 * Payload for vote:statistics event.
 */
export interface VoteStatisticsPayload {
  venues: {
    venueId: string;
    voteCount: number;
    voterNames: string[];
  }[];
  totalVotes: number;
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
