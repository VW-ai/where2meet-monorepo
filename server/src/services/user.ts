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

/**
 * User service.
 *
 * Provides methods for user profile management.
 */
export class UserService {
  private readonly userRepository;

  constructor(db: PrismaClient) {
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
   * - defaultFuzzyLocation
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
}

/**
 * Creates a new UserService instance.
 * @param db - Prisma client instance
 * @returns UserService instance
 */
export function createUserService(db: PrismaClient): UserService {
  return new UserService(db);
}
