/**
 * Event repository module.
 *
 * Handles all database operations for Event entities.
 * @module repositories/event
 */

import type { PrismaClient, Event, Participant } from "../generated/prisma/index.js";
import { Prisma } from "../generated/prisma/index.js";
import type { CreateEventInput, UpdateEventInput } from "../schemas/event.js";
import { generateEventId } from "../utils/id.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("EventRepository");

/** Maximum retry attempts for ID collision */
const MAX_ID_GENERATION_RETRIES = 3;

/**
 * Event with participants included.
 */
export interface EventWithParticipants extends Event {
  participants: Participant[];
}

/**
 * Data for creating a new event in the database.
 */
export interface CreateEventData extends CreateEventInput {
  organizerToken: string;
}

/**
 * Repository for Event database operations.
 */
export class EventRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates a new event in the database.
   *
   * Generates a semantic event ID and handles collision retry.
   * @param data - Event data including generated organizerToken
   * @returns Created event with participants (empty array)
   * @throws Error if ID generation fails after max retries
   */
  async create(data: CreateEventData): Promise<EventWithParticipants> {
    for (let attempt = 1; attempt <= MAX_ID_GENERATION_RETRIES; attempt++) {
      const eventId = generateEventId();

      try {
        return await this.db.event.create({
          data: {
            id: eventId,
            title: data.title,
            meetingTime: data.meetingTime ? new Date(data.meetingTime) : null,
            organizerToken: data.organizerToken,
          },
          include: {
            participants: true,
          },
        });
      } catch (error) {
        // Check for unique constraint violation (ID collision)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          logger.warn(
            { eventId, attempt, maxAttempts: MAX_ID_GENERATION_RETRIES },
            "Event ID collision detected, retrying"
          );
          continue;
        }
        throw error;
      }
    }

    logger.error(
      { maxAttempts: MAX_ID_GENERATION_RETRIES },
      "Failed to generate unique event ID after max retries"
    );
    throw new Error(
      `Failed to generate unique event ID after ${MAX_ID_GENERATION_RETRIES} attempts`
    );
  }

  /**
   * Finds an event by its ID.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns Event with participants, or null if not found
   */
  async findById(id: string): Promise<EventWithParticipants | null> {
    return this.db.event.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Finds an event by its ID, including the organizerToken.
   * Used for authentication verification.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns Event with organizerToken, or null if not found
   */
  async findByIdWithToken(id: string): Promise<Event | null> {
    return this.db.event.findUnique({
      where: { id },
    });
  }

  /**
   * Updates an event's fields.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @param data - Fields to update
   * @returns Updated event with participants
   */
  async update(id: string, data: UpdateEventInput): Promise<EventWithParticipants> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.meetingTime !== undefined) {
      updateData.meetingTime = data.meetingTime ? new Date(data.meetingTime) : null;
    }

    return this.db.event.update({
      where: { id },
      data: updateData,
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Deletes an event and all related data (cascades).
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns Deleted event
   */
  async delete(id: string): Promise<Event> {
    return this.db.event.delete({
      where: { id },
    });
  }

  /**
   * Checks if an event exists.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns True if event exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.db.event.count({
      where: { id },
    });
    return count > 0;
  }
}

/**
 * Creates a new EventRepository instance.
 * @param db - Prisma client instance
 * @returns EventRepository instance
 */
export function createEventRepository(db: PrismaClient): EventRepository {
  return new EventRepository(db);
}
