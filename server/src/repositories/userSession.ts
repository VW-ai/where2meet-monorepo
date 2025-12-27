/**
 * UserSession repository module.
 *
 * Handles all database operations for UserSession entities.
 * Sessions are stored with hashed tokens for security.
 * @module repositories/userSession
 */

import type { PrismaClient, UserSession, User } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { generateSessionId } from "../utils/id.js";

const logger = createLogger("UserSessionRepository");

/**
 * Data for creating a new session.
 */
export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Session with associated user data.
 */
export type SessionWithUser = UserSession & {
  user: User;
};

/**
 * Repository for UserSession database operations.
 */
export class UserSessionRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates a new session.
   * @param data - Session data including hashed token
   * @returns Created session
   */
  async create(data: CreateSessionData): Promise<UserSession> {
    const id = generateSessionId();
    logger.debug({ userId: data.userId }, "Creating session");

    return this.db.userSession.create({
      data: {
        id,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Finds a session by token hash.
   * @param tokenHash - SHA-256 hash of the session token
   * @returns Session with user or null if not found
   */
  async findByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
    return this.db.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  /**
   * Finds a valid (non-expired) session by token hash.
   * @param tokenHash - SHA-256 hash of the session token
   * @returns Session with user or null if not found or expired
   */
  async findValidByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
    const session = await this.db.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      // Auto-cleanup expired session
      await this.delete(session.id);
      return null;
    }

    return session;
  }

  /**
   * Deletes a session by ID.
   * @param id - Session ID
   */
  async delete(id: string): Promise<void> {
    logger.debug({ sessionId: id }, "Deleting session");

    await this.db.userSession.delete({
      where: { id },
    });
  }

  /**
   * Deletes a session by token hash.
   * Used for logout.
   * @param tokenHash - SHA-256 hash of the session token
   */
  async deleteByTokenHash(tokenHash: string): Promise<void> {
    logger.debug("Deleting session by token hash");

    await this.db.userSession.delete({
      where: { tokenHash },
    });
  }

  /**
   * Deletes all sessions for a user.
   * Used for password reset or account security.
   * @param userId - User ID
   * @returns Number of deleted sessions
   */
  async deleteAllForUser(userId: string): Promise<number> {
    logger.debug({ userId }, "Deleting all sessions for user");

    const result = await this.db.userSession.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Deletes all expired sessions.
   * Used for cleanup/maintenance.
   * @returns Number of deleted sessions
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, "Cleaned up expired sessions");
    }

    return result.count;
  }
}

/**
 * Creates a new UserSessionRepository instance.
 * @param db - Prisma client instance
 * @returns UserSessionRepository instance
 */
export function createUserSessionRepository(db: PrismaClient): UserSessionRepository {
  return new UserSessionRepository(db);
}
