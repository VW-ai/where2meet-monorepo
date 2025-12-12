/**
 * Event repository module.
 *
 * Handles all database operations for Event entities.
 * @module repositories/event
 */

import type { PrismaClient, Event, Participant } from "../generated/prisma/index.js";
import type { CreateEventInput, UpdateEventInput } from "../schemas/event.js";

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
   * @param data - Event data including generated organizerToken
   * @returns Created event with participants (empty array)
   */
  async create(data: CreateEventData): Promise<EventWithParticipants> {
    return this.db.event.create({
      data: {
        title: data.title,
        meetingTime: data.meetingTime ? new Date(data.meetingTime) : null,
        organizerToken: data.organizerToken,
      },
      include: {
        participants: true,
      },
    });
  }

  /**
   * Finds an event by its ID.
   * @param id - Event UUID
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
   * @param id - Event UUID
   * @returns Event with organizerToken, or null if not found
   */
  async findByIdWithToken(id: string): Promise<Event | null> {
    return this.db.event.findUnique({
      where: { id },
    });
  }

  /**
   * Updates an event's fields.
   * @param id - Event UUID
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
   * @param id - Event UUID
   * @returns Deleted event
   */
  async delete(id: string): Promise<Event> {
    return this.db.event.delete({
      where: { id },
    });
  }

  /**
   * Checks if an event exists.
   * @param id - Event UUID
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
