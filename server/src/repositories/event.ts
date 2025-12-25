/**
 * Event repository module.
 *
 * Handles all database operations for Event entities.
 * @module repositories/event
 */

import type { PrismaClient, Event, Participant } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
  organizerTokenHash: string;
}

/**
 * Data for creating organizer participant alongside event.
 */
export interface OrganizerParticipantData {
  name: string;
  color: string;
  tokenHash: string;
}

/**
 * Result of creating event with organizer participant.
 */
export interface CreateEventWithOrganizerResult {
  event: EventWithParticipants;
  organizerParticipantId: string;
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
            organizerTokenHash: data.organizerTokenHash,
          },
          include: {
            participants: true,
          },
        });
      } catch (error) {
        // Check for unique constraint violation (ID collision)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
      `Failed to generate unique event ID after ${String(MAX_ID_GENERATION_RETRIES)} attempts`
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
   * Gets the organizerTokenHash for an event.
   * Used for authentication verification.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns Token hash or null if event doesn't exist
   */
  async getTokenHash(id: string): Promise<string | null> {
    const event = await this.db.event.findUnique({
      where: { id },
      select: { organizerTokenHash: true },
    });
    return event?.organizerTokenHash ?? null;
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

  /**
   * Gets the publish status of an event.
   * Lightweight query that only fetches publishedAt field.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns publishedAt timestamp or null, or undefined if event doesn't exist
   */
  async getPublishStatus(id: string): Promise<{ publishedAt: Date | null } | null> {
    return this.db.event.findUnique({
      where: { id },
      select: { publishedAt: true },
    });
  }

  /**
   * Publishes an event with the selected venue.
   * Sets publishedVenueId and publishedAt timestamp.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @param venueId - Google Place ID of the selected venue
   * @returns Updated event with participants
   */
  async publish(id: string, venueId: string): Promise<EventWithParticipants> {
    logger.debug({ eventId: id, venueId }, "Publishing event");

    return this.db.event.update({
      where: { id },
      data: {
        publishedVenueId: venueId,
        publishedAt: new Date(),
      },
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Unpublishes an event, clearing the published venue.
   * Sets publishedVenueId and publishedAt to null.
   * @param id - Event ID (semantic format: evt_timestamp_random)
   * @returns Updated event with participants
   */
  async unpublish(id: string): Promise<EventWithParticipants> {
    logger.debug({ eventId: id }, "Unpublishing event");

    return this.db.event.update({
      where: { id },
      data: {
        publishedVenueId: null,
        publishedAt: null,
      },
      include: {
        participants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Creates a new event with an organizer participant atomically.
   *
   * Generates a semantic event ID and handles collision retry.
   * Both event and organizer participant are created in a single transaction.
   * @param eventData - Event data including generated organizerToken
   * @param organizerData - Organizer participant data
   * @returns Created event with participants and organizerParticipantId
   * @throws Error if ID generation fails after max retries
   */
  async createWithOrganizerParticipant(
    eventData: CreateEventData,
    organizerData: OrganizerParticipantData
  ): Promise<CreateEventWithOrganizerResult> {
    for (let attempt = 1; attempt <= MAX_ID_GENERATION_RETRIES; attempt++) {
      const eventId = generateEventId();

      try {
        const result = await this.db.$transaction(async (tx) => {
          // Create the event
          const event = await tx.event.create({
            data: {
              id: eventId,
              title: eventData.title,
              meetingTime: eventData.meetingTime ? new Date(eventData.meetingTime) : null,
              organizerTokenHash: eventData.organizerTokenHash,
            },
          });

          // Create organizer participant (initially no location). MEC calculations
          // include any participant with valid coordinates, so the organizer will be
          // included once they add a location.
          const organizerParticipant = await tx.participant.create({
            data: {
              eventId: event.id,
              name: organizerData.name,
              address: null,
              formattedAddress: null,
              lat: null,
              lng: null,
              fuzzyLocation: false,
              color: organizerData.color,
              tokenHash: organizerData.tokenHash,
              isOrganizer: true,
            },
          });

          // Re-fetch event with the new participant included
          const eventWithParticipants = await tx.event.findUniqueOrThrow({
            where: { id: event.id },
            include: {
              participants: {
                orderBy: { createdAt: "asc" },
              },
            },
          });

          return {
            event: eventWithParticipants,
            organizerParticipantId: organizerParticipant.id,
          };
        });

        return result;
      } catch (error) {
        // Check for unique constraint violation (ID collision)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
      `Failed to generate unique event ID after ${String(MAX_ID_GENERATION_RETRIES)} attempts`
    );
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
