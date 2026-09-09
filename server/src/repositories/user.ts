/**
 * User repository module.
 *
 * Handles all database operations for User entities.
 * @module repositories/user
 */

import type { PrismaClient, User } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { generateUserId } from "../utils/id.js";

const logger = createLogger("UserRepository");

/**
 * Data for creating a new user.
 */
export interface CreateUserData {
  email: string;
  name?: string;
}

/**
 * Data for updating a user profile.
 * Null values explicitly set field to null, undefined values are skipped.
 */
export interface UpdateUserData {
  name?: string | null;
  avatarUrl?: string | null;
  defaultAddress?: string | null;
  defaultPlaceId?: string | null;
  defaultFuzzyLocation?: boolean;
}

/**
 * Repository for User database operations.
 */
export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates a new user.
   * @param data - User data
   * @returns Created user
   */
  async create(data: CreateUserData): Promise<User> {
    const id = generateUserId();
    logger.debug({ email: data.email }, "Creating user");

    return this.db.user.create({
      data: {
        id,
        email: data.email.toLowerCase().trim(),
        name: data.name ?? null,
      },
    });
  }

  /**
   * Finds a user by ID.
   * @param id - User ID
   * @returns User or null if not found
   */
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { id },
    });
  }

  /**
   * Finds a user by email (case-insensitive).
   * @param email - Email address
   * @returns User or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Checks if a user with the given email exists.
   * @param email - Email address
   * @returns True if email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.db.user.count({
      where: { email: email.toLowerCase().trim() },
    });
    return count > 0;
  }

  /**
   * Updates a user's profile.
   * @param id - User ID
   * @param data - Fields to update
   * @returns Updated user
   */
  async update(id: string, data: UpdateUserData): Promise<User> {
    logger.debug({ userId: id }, "Updating user");

    return this.db.user.update({
      where: { id },
      data,
    });
  }
}

/**
 * Creates a new UserRepository instance.
 * @param db - Prisma client instance
 * @returns UserRepository instance
 */
export function createUserRepository(db: PrismaClient): UserRepository {
  return new UserRepository(db);
}
