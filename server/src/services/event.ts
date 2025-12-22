/**
 * Event service module.
 *
 * Contains business logic for event operations.
 * Returns raw database entities - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 * @module services/event
 */

import type { PrismaClient } from "../generated/prisma/index.js";
import {
  createEventRepository,
  type EventRepository,
  type EventWithParticipants,
} from "../repositories/event.js";
import type { CreateEventInput, UpdateEventInput } from "../schemas/event.js";
import { EventNotFoundError } from "../types/errors.js";
import { generateOrganizerToken, verifyToken } from "../utils/token.js";
import { PARTICIPANT_COLORS } from "../utils/colors.js";

/**
 * Result of creating an event.
 * Includes the entity, organizerToken, and organizerParticipantId.
 */
export interface CreateEventResult {
  event: EventWithParticipants;
  organizerToken: string;
  organizerParticipantId: string;
}

/**
 * Service for event business logic.
 *
 * All methods return raw database entities. Transformation to
 * Response DTOs should be done in route handlers using mappers.
 */
export class EventService {
  private readonly repository: EventRepository;

  constructor(db: PrismaClient) {
    this.repository = createEventRepository(db);
  }

  /**
   * Creates a new event with an auto-created organizer participant.
   * The organizer participant has no location and is excluded from MEC calculation.
   * Uses repository with ID collision retry logic.
   * @param input - Event creation data
   * @returns Created event entity, organizerToken, and organizerParticipantId
   */
  async createEvent(input: CreateEventInput): Promise<CreateEventResult> {
    const { token: organizerToken, hash: organizerTokenHash } = generateOrganizerToken();

    // Use repository method with ID collision retry logic
    const result = await this.repository.createWithOrganizerParticipant(
      {
        title: input.title,
        meetingTime: input.meetingTime,
        organizerTokenHash,
      },
      {
        name: "Organizer",
        color: PARTICIPANT_COLORS[0],
        tokenHash: organizerTokenHash,
      }
    );

    return {
      event: result.event,
      organizerToken,
      organizerParticipantId: result.organizerParticipantId,
    };
  }

  /**
   * Gets an event by ID.
   * @param id - Event UUID
   * @returns Event entity with participants
   * @throws EventNotFoundError if event doesn't exist
   */
  async getEvent(id: string): Promise<EventWithParticipants> {
    const event = await this.repository.findById(id);

    if (!event) {
      throw new EventNotFoundError(id);
    }

    return event;
  }

  /**
   * Updates an event.
   * @param id - Event UUID
   * @param input - Fields to update
   * @returns Updated event entity
   * @throws EventNotFoundError if event doesn't exist
   */
  async updateEvent(id: string, input: UpdateEventInput): Promise<EventWithParticipants> {
    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new EventNotFoundError(id);
    }

    return this.repository.update(id, input);
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
   * @param eventId - Event ID
   * @param token - Plaintext token to verify
   * @returns True if token is valid
   * @throws EventNotFoundError if event doesn't exist
   */
  async verifyOrganizerToken(eventId: string, token: string): Promise<boolean> {
    const storedHash = await this.repository.getTokenHash(eventId);

    if (storedHash === null) {
      throw new EventNotFoundError(eventId);
    }

    return verifyToken(token, storedHash);
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
