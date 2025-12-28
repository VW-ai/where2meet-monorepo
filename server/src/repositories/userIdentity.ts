/**
 * UserIdentity repository module.
 *
 * Handles all database operations for UserIdentity entities.
 * Supports multiple authentication providers per user.
 * @module repositories/userIdentity
 */

import type { PrismaClient, UserIdentity } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { generateIdentityId } from "../utils/id.js";

const logger = createLogger("UserIdentityRepository");

/** Supported authentication providers */
export type AuthProvider = "email" | "google" | "github";

/**
 * Data for creating a new email identity.
 */
export interface CreateEmailIdentityData {
  userId: string;
  email: string;
  passwordHash: string;
}

/**
 * Repository for UserIdentity database operations.
 */
export class UserIdentityRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates an email identity for a user.
   * @param data - Identity data including password hash
   * @returns Created identity
   */
  async createEmailIdentity(data: CreateEmailIdentityData): Promise<UserIdentity> {
    const id = generateIdentityId();
    logger.debug({ userId: data.userId }, "Creating email identity");

    return this.db.userIdentity.create({
      data: {
        id,
        userId: data.userId,
        provider: "email",
        providerId: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
      },
    });
  }

  /**
   * Finds an identity by provider and provider ID.
   * @param provider - Auth provider (email, google, github)
   * @param providerId - Provider-specific identifier
   * @returns Identity with user or null if not found
   */
  async findByProvider(
    provider: AuthProvider,
    providerId: string
  ): Promise<(UserIdentity & { user: { id: string; email: string; name: string | null } }) | null> {
    return this.db.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: providerId.toLowerCase().trim(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Finds an email identity by email address.
   * Convenience method for login flow.
   * @param email - Email address
   * @returns Identity with password hash or null if not found
   */
  async findByEmail(
    email: string
  ): Promise<(UserIdentity & { user: { id: string; email: string; name: string | null } }) | null> {
    return this.findByProvider("email", email);
  }
}

/**
 * Creates a new UserIdentityRepository instance.
 * @param db - Prisma client instance
 * @returns UserIdentityRepository instance
 */
export function createUserIdentityRepository(db: PrismaClient): UserIdentityRepository {
  return new UserIdentityRepository(db);
}
