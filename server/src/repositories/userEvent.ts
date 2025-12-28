/**
 * UserEvent repository module.
 *
 * Handles all database operations for UserEvent entities.
 * Links users to events they've created or participated in.
 * @module repositories/userEvent
 */

import type { PrismaClient, UserEvent, Event, Participant } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { generateUserEventId } from "../utils/id.js";

const logger = createLogger("UserEventRepository");

/** User's role in an event */
export type UserEventRole = "organizer" | "participant";

/**
 * Data for creating or upserting a user-event link.
 */
export interface CreateUserEventData {
  userId: string;
  eventId: string;
  participantId: string | null;
  role: UserEventRole;
}

/**
 * UserEvent with related event data (excludes sensitive tokens).
 */
export type UserEventWithEvent = UserEvent & {
  event: Omit<Event, "organizerTokenHash"> & {
    participants: Pick<Participant, "id" | "name" | "color" | "isOrganizer">[];
    _count: { participants: number };
  };
};

/**
 * Repository for UserEvent database operations.
 */
export class UserEventRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates or updates a user-event link (idempotent).
   * Uses Prisma upsert to handle race conditions gracefully.
   * @param data - User event link data
   * @returns Created or existing user event
   */
  async upsert(data: CreateUserEventData): Promise<UserEvent> {
    logger.debug(
      { userId: data.userId, eventId: data.eventId, role: data.role },
      "Upserting user-event link"
    );

    return this.db.userEvent.upsert({
      where: {
        userId_eventId: {
          userId: data.userId,
          eventId: data.eventId,
        },
      },
      create: {
        id: generateUserEventId(),
        userId: data.userId,
        eventId: data.eventId,
        participantId: data.participantId,
        role: data.role,
      },
      update: {
        // Self-healing: restore participantId/role if they were cleared
        // (e.g., participant deleted then user re-claims with new token)
        participantId: data.participantId,
        role: data.role,
      },
    });
  }

  /**
   * Finds a user-event link by user and event.
   * @param userId - User ID
   * @param eventId - Event ID
   * @returns UserEvent or null if not linked
   */
  async findByUserAndEvent(userId: string, eventId: string): Promise<UserEvent | null> {
    return this.db.userEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });
  }

  /**
   * Finds all events linked to a user.
   * Excludes sensitive token data from response.
   * @param userId - User ID
   * @returns Array of user events with event details
   */
  async findByUserId(userId: string): Promise<UserEventWithEvent[]> {
    const userEvents = await this.db.userEvent.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            participants: {
              select: {
                id: true,
                name: true,
                color: true,
                isOrganizer: true,
              },
              orderBy: { createdAt: "asc" },
            },
            _count: {
              select: { participants: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Type assertion needed because Prisma doesn't know we're excluding fields
    return userEvents as unknown as UserEventWithEvent[];
  }

  /**
   * Checks if a user is linked to an event.
   * @param userId - User ID
   * @param eventId - Event ID
   * @returns True if user is linked to event
   */
  async isLinked(userId: string, eventId: string): Promise<boolean> {
    const count = await this.db.userEvent.count({
      where: { userId, eventId },
    });
    return count > 0;
  }

  /**
   * Deletes a user-event link.
   * @param userId - User ID
   * @param eventId - Event ID
   */
  async delete(userId: string, eventId: string): Promise<void> {
    logger.debug({ userId, eventId }, "Deleting user-event link");

    await this.db.userEvent.delete({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });
  }
}

/**
 * Creates a new UserEventRepository instance.
 * @param db - Prisma client instance
 * @returns UserEventRepository instance
 */
export function createUserEventRepository(db: PrismaClient): UserEventRepository {
  return new UserEventRepository(db);
}
