/**
 * Event service module.
 *
 * Contains business logic for event operations.
 * @module services/event
 */

import crypto from "crypto";
import type { PrismaClient } from "../generated/prisma/index.js";
import {
  createEventRepository,
  type EventRepository,
  type EventWithParticipants,
} from "../repositories/event.js";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventResponse,
  CreateEventResponse,
  ParticipantResponse,
} from "../schemas/event.js";
import { EventNotFoundError } from "../types/errors.js";

/** Length of the organizer token in characters */
const ORGANIZER_TOKEN_LENGTH = 64;

/**
 * Generates a cryptographically secure random token.
 * @param length - Length of the token in characters
 * @returns Random hex string
 */
function generateSecureToken(length: number): string {
  return crypto.randomBytes(length / 2).toString("hex");
}

/**
 * Transforms a database participant to API response format.
 */
function transformParticipant(participant: EventWithParticipants["participants"][0]): ParticipantResponse {
  return {
    id: participant.id,
    name: participant.name,
    address: participant.address,
    location: {
      lat: Number(participant.lat),
      lng: Number(participant.lng),
    },
    color: participant.color,
    fuzzyLocation: participant.fuzzyLocation,
  };
}

/**
 * Transforms a database event to API response format.
 * Does NOT include organizerToken.
 */
function transformEventResponse(event: EventWithParticipants): EventResponse {
  return {
    id: event.id,
    title: event.title,
    meetingTime: event.meetingTime?.toISOString() ?? null,
    organizerId: event.id, // For now, organizerId equals event id
    participants: event.participants.map(transformParticipant),
    publishedVenueId: event.publishedVenueId,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    settings: {
      allowParticipantsAfterPublish: false,
    },
  };
}

/**
 * Service for event business logic.
 */
export class EventService {
  private readonly repository: EventRepository;

  constructor(db: PrismaClient) {
    this.repository = createEventRepository(db);
  }

  /**
   * Creates a new event.
   * @param input - Event creation data
   * @returns Created event with organizerToken (only time token is returned)
   */
  async createEvent(input: CreateEventInput): Promise<CreateEventResponse> {
    const organizerToken = generateSecureToken(ORGANIZER_TOKEN_LENGTH);

    const event = await this.repository.create({
      ...input,
      organizerToken,
    });

    return {
      ...transformEventResponse(event),
      organizerToken,
    };
  }

  /**
   * Gets an event by ID.
   * @param id - Event UUID
   * @returns Event data (without organizerToken)
   * @throws EventNotFoundError if event doesn't exist
   */
  async getEvent(id: string): Promise<EventResponse> {
    const event = await this.repository.findById(id);

    if (!event) {
      throw new EventNotFoundError(id);
    }

    return transformEventResponse(event);
  }

  /**
   * Updates an event.
   * @param id - Event UUID
   * @param input - Fields to update
   * @returns Updated event data
   * @throws EventNotFoundError if event doesn't exist
   */
  async updateEvent(id: string, input: UpdateEventInput): Promise<EventResponse> {
    // Check event exists first
    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new EventNotFoundError(id);
    }

    const event = await this.repository.update(id, input);
    return transformEventResponse(event);
  }

  /**
   * Deletes an event.
   * @param id - Event UUID
   * @throws EventNotFoundError if event doesn't exist
   */
  async deleteEvent(id: string): Promise<void> {
    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new EventNotFoundError(id);
    }

    await this.repository.delete(id);
  }

  /**
   * Verifies that a token matches the event's organizerToken.
   * @param eventId - Event UUID
   * @param token - Token to verify
   * @returns True if token is valid
   * @throws EventNotFoundError if event doesn't exist
   */
  async verifyOrganizerToken(eventId: string, token: string): Promise<boolean> {
    const event = await this.repository.findByIdWithToken(eventId);

    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    // Use timing-safe comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token);
    const storedBuffer = Buffer.from(event.organizerToken);

    if (tokenBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuffer, storedBuffer);
  }
}

/**
 * Creates a new EventService instance.
 * @param db - Prisma client instance
 * @returns EventService instance
 */
export function createEventService(db: PrismaClient): EventService {
  return new EventService(db);
}
