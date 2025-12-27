/**
 * UserEvent service module.
 *
 * Handles event claiming and listing for users.
 * @module services/userEvent
 */

import type { PrismaClient, UserEvent } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { createUserEventRepository, type UserEventWithEvent } from "../repositories/userEvent.js";
import { createEventRepository } from "../repositories/event.js";
import { createParticipantService } from "./participant.js";
import { EventNotFoundError, ForbiddenError } from "../types/errors.js";

const logger = createLogger("UserEventService");

/**
 * Input for claiming an event.
 */
export interface ClaimEventInput {
  userId: string;
  eventId: string;
  participantToken: string;
}

/**
 * UserEvent service.
 *
 * Provides methods for claiming events and listing user's events.
 */
export class UserEventService {
  private readonly userEventRepository;
  private readonly eventRepository;
  private readonly participantService;

  constructor(db: PrismaClient) {
    this.userEventRepository = createUserEventRepository(db);
    this.eventRepository = createEventRepository(db);
    this.participantService = createParticipantService(db);
  }

  /**
   * Claims an event for a user using their participant token.
   *
   * Flow:
   * 1. Verify event exists
   * 2. Verify participant token is valid for the event
   * 3. Determine role from isOrganizer flag
   * 4. Create or return existing user-event link (idempotent)
   * @param input - Claim input including user ID, event ID, and participant token
   * @returns Created or existing UserEvent
   * @throws EventNotFoundError if event doesn't exist
   * @throws ForbiddenError if participant token is invalid
   */
  async claimEvent(input: ClaimEventInput): Promise<UserEvent> {
    const { userId, eventId, participantToken } = input;

    logger.info({ userId, eventId }, "Claiming event");

    // Verify event exists
    const eventExists = await this.eventRepository.exists(eventId);
    if (!eventExists) {
      throw new EventNotFoundError(eventId);
    }

    // Verify participant token and get details
    const authResult = await this.participantService.findParticipantByTokenWithDetails(
      eventId,
      participantToken
    );

    if (!authResult) {
      throw new ForbiddenError("Invalid participant token");
    }

    // Determine role from isOrganizer
    const role = authResult.isOrganizer ? "organizer" : "participant";

    // Create or get existing user-event link
    const userEvent = await this.userEventRepository.upsert({
      userId,
      eventId,
      participantId: authResult.participantId,
      role,
    });

    logger.info({ userId, eventId, role }, "Event claimed successfully");

    return userEvent;
  }

  /**
   * Lists all events linked to a user.
   *
   * Returns events with participant info but excludes sensitive tokens.
   * @param userId - User ID
   * @returns Array of user events with event details
   */
  async listEvents(userId: string): Promise<UserEventWithEvent[]> {
    logger.debug({ userId }, "Listing user events");

    return this.userEventRepository.findByUserId(userId);
  }

  /**
   * Checks if a user is linked to an event.
   * @param userId - User ID
   * @param eventId - Event ID
   * @returns True if user is linked to event
   */
  async isLinked(userId: string, eventId: string): Promise<boolean> {
    return this.userEventRepository.isLinked(userId, eventId);
  }
}

/**
 * Creates a new UserEventService instance.
 * @param db - Prisma client instance
 * @returns UserEventService instance
 */
export function createUserEventService(db: PrismaClient): UserEventService {
  return new UserEventService(db);
}
