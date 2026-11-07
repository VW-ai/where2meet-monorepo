/**
 * User service module.
 *
 * Handles user profile operations.
 * @module services/user
 */

import type { PrismaClient, User } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { createUserRepository, type UpdateUserData } from "../repositories/user.js";
import { NotFoundError } from "../types/errors.js";

const logger = createLogger("UserService");

/** Shown in place of a deleted account's name in meetings other people still use. */
const DELETED_PARTICIPANT_NAME = "Former guest";

/**
 * User service.
 *
 * Provides methods for user profile management.
 */
export class UserService {
  private readonly userRepository;

  constructor(private readonly db: PrismaClient) {
    this.userRepository = createUserRepository(db);
  }

  /**
   * Gets a user's profile by ID.
   * @param userId - User ID
   * @returns User profile
   * @throws NotFoundError if user doesn't exist
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }
    return user;
  }

  /**
   * Updates a user's profile.
   *
   * Allowed fields:
   * - name
   * - avatarUrl
   * - defaultAddress
   * - defaultPlaceId
   * @param userId - User ID
   * @param data - Fields to update
   * @returns Updated user profile
   * @throws NotFoundError if user doesn't exist
   */
  async updateProfile(userId: string, data: UpdateUserData): Promise<User> {
    // Verify user exists first
    const exists = await this.userRepository.findById(userId);
    if (!exists) {
      throw new NotFoundError("User");
    }

    logger.info({ userId }, "Updating user profile");

    return this.userRepository.update(userId, data);
  }

  /**
   * Permanently deletes an account and the person's data in their meetings.
   *
   * A meeting they organized that nobody else joined is deleted. Any other
   * meeting stays for the group, with their name, starting point, access token
   * and usage history removed.
   * @param userId - User ID
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const links = await tx.userEvent.findMany({ where: { userId } });

      for (const { eventId, participantId, role } of links) {
        const othersJoined =
          (await tx.participant.count({
            where: {
              eventId,
              tokenHash: { not: null },
              ...(participantId ? { id: { not: participantId } } : {}),
            },
          })) > 0;

        if (role === "organizer" && !othersJoined) {
          await tx.event.delete({ where: { id: eventId } });
        } else if (participantId) {
          await tx.meetingVisit.deleteMany({ where: { participantId } });
          await tx.venueSearch.deleteMany({ where: { participantId } });
          await tx.participant.update({
            where: { id: participantId },
            data: {
              name: DELETED_PARTICIPANT_NAME,
              address: null,
              formattedAddress: null,
              lat: null,
              lng: null,
              tokenHash: null,
            },
          });
        }
      }

      await tx.user.delete({ where: { id: userId } });
    });

    logger.info({ userId }, "Account deleted");
  }
}

/**
 * Creates a new UserService instance.
 * @param db - Prisma client instance
 * @returns UserService instance
 */
export function createUserService(db: PrismaClient): UserService {
  return new UserService(db);
}
