/**
 * Event service module.
 *
 * Contains business logic for event operations.
 * Returns raw database entities - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 *
 * @module services/event
 */

import crypto from "crypto";
import type { PrismaClient } from "../generated/prisma/index.js";
import {
  createEventRepository,
  type EventRepository,
  type EventWithParticipants,
} from "../repositories/event.js";
import type { CreateEventInput, UpdateEventInput } from "../schemas/event.js";
import { EventNotFoundError } from "../types/errors.js";

/** Length of the organizer token in characters */
const ORGANIZER_TOKEN_LENGTH = 64;

/**
 * Result of creating an event.
 * Includes both the entity and the organizerToken.
 */
export interface CreateEventResult {
  event: EventWithParticipants;
  organizerToken: string;
}

/**
 * Generates a cryptographically secure random token.
 * @param length - Length of the token in characters
 * @returns Random hex string
 */
function generateSecureToken(length: number): string {
  return crypto.randomBytes(length / 2).toString("hex");
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
   * Creates a new event.
   * @param input - Event creation data
   * @returns Created event entity and organizerToken
   */
  async createEvent(input: CreateEventInput): Promise<CreateEventResult> {
    const organizerToken = generateSecureToken(ORGANIZER_TOKEN_LENGTH);

    const event = await this.repository.create({
      ...input,
      organizerToken,
    });

    return { event, organizerToken };
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
