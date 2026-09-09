/**
 * Authentication service module.
 *
 * Handles user registration, login, logout, and session validation.
 * Uses bcrypt for password hashing and SHA-256 for session tokens.
 * @module services/auth
 */

import type { PrismaClient, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createLogger } from "../lib/logger.js";
import { createUserRepository } from "../repositories/user.js";
import { createUserIdentityRepository } from "../repositories/userIdentity.js";
import { createUserSessionRepository, type SessionWithUser } from "../repositories/userSession.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateSessionToken, getSessionExpiresAt } from "../utils/session.js";
import { hashToken } from "../utils/token.js";
import { generateUserId, generateIdentityId, generateSessionId } from "../utils/id.js";
import { EmailExistsError, InvalidCredentialsError, UnauthorizedError } from "../types/errors.js";

const logger = createLogger("AuthService");

/**
 * Input for user registration.
 */
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

/**
 * Result of successful registration or login.
 */
export interface AuthResult {
  user: User;
  sessionToken: string;
}

/**
 * Authentication service.
 *
 * Provides methods for user registration, login, logout, and session validation.
 */
export class AuthService {
  private readonly userRepository;
  private readonly identityRepository;
  private readonly sessionRepository;

  constructor(private readonly db: PrismaClient) {
    this.userRepository = createUserRepository(db);
    this.identityRepository = createUserIdentityRepository(db);
    this.sessionRepository = createUserSessionRepository(db);
  }

  /**
   * Registers a new user with email and password.
   *
   * Flow:
   * 1. Check if email already exists
   * 2. Create user, identity, and session atomically
   * 3. Return user and session token
   * @param input - Registration data
   * @returns User and session token
   * @throws EmailExistsError if email is already registered
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    logger.info({ email: normalizedEmail }, "Registering new user");

    // Check if email exists
    const emailExists = await this.userRepository.emailExists(normalizedEmail);
    if (emailExists) {
      throw new EmailExistsError();
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Generate session token
    const { token: sessionToken, hash: sessionTokenHash } = generateSessionToken();
    const expiresAt = getSessionExpiresAt();

    // Pre-generate IDs before transaction (avoids dynamic imports inside transaction)
    const userId = generateUserId();
    const identityId = generateIdentityId();
    const sessionId = generateSessionId();

    // Create user, identity, and session atomically
    let user: User;
    try {
      user = await this.db.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            id: userId,
            email: normalizedEmail,
            name: input.name ?? null,
          },
        });

        // Create email identity
        await tx.userIdentity.create({
          data: {
            id: identityId,
            userId: newUser.id,
            provider: "email",
            providerId: normalizedEmail,
            passwordHash,
          },
        });

        // Create session
        await tx.userSession.create({
          data: {
            id: sessionId,
            userId: newUser.id,
            tokenHash: sessionTokenHash,
            expiresAt,
          },
        });

        return newUser;
      });
    } catch (error) {
      // Handle race condition: email was taken between check and insert
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        logger.warn({ email: normalizedEmail }, "Registration failed: email race condition");
        throw new EmailExistsError();
      }
      throw error;
    }

    logger.info({ userId: user.id }, "User registered successfully");

    return {
      user,
      sessionToken,
    };
  }

  /**
   * Authenticates a user with email and password.
   *
   * Flow:
   * 1. Find identity by email
   * 2. Verify password
   * 3. Create new session
   * 4. Return user and session token
   * @param email - User's email address
   * @param password - User's password
   * @returns User and session token
   * @throws InvalidCredentialsError if credentials are invalid
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    logger.info({ email: normalizedEmail }, "Login attempt");

    // Find identity
    const identity = await this.identityRepository.findByEmail(normalizedEmail);
    if (!identity || !identity.passwordHash) {
      logger.warn({ email: normalizedEmail }, "Login failed: identity not found");
      throw new InvalidCredentialsError();
    }

    // Verify password
    const passwordValid = await verifyPassword(password, identity.passwordHash);
    if (!passwordValid) {
      logger.warn({ email: normalizedEmail }, "Login failed: invalid password");
      throw new InvalidCredentialsError();
    }

    // Get full user
    const user = await this.userRepository.findById(identity.userId);
    if (!user) {
      logger.error({ userId: identity.userId }, "Login failed: user not found for valid identity");
      throw new InvalidCredentialsError();
    }

    // Generate session token
    const { token: sessionToken, hash: sessionTokenHash } = generateSessionToken();
    const expiresAt = getSessionExpiresAt();

    // Create session
    await this.sessionRepository.create({
      userId: user.id,
      tokenHash: sessionTokenHash,
      expiresAt,
    });

    logger.info({ userId: user.id }, "Login successful");

    return {
      user,
      sessionToken,
    };
  }

  /**
   * Logs out a user by invalidating their session.
   * @param sessionToken - The session token from cookie
   */
  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashToken(sessionToken);

    try {
      await this.sessionRepository.deleteByTokenHash(tokenHash);
      logger.info("Session invalidated");
    } catch {
      // Session might not exist (already logged out)
      logger.debug("Session not found during logout (may already be invalidated)");
    }
  }

  /**
   * Validates a session token and returns the associated user.
   * @param sessionToken - The session token from cookie
   * @returns Session with user data
   * @throws UnauthorizedError if session is invalid or expired
   */
  async validateSession(sessionToken: string): Promise<SessionWithUser> {
    const tokenHash = hashToken(sessionToken);

    const session = await this.sessionRepository.findValidByTokenHash(tokenHash);
    if (!session) {
      throw new UnauthorizedError("Invalid or expired session");
    }

    return session;
  }
}

/**
 * Creates a new AuthService instance.
 * @param db - Prisma client instance
 * @returns AuthService instance
 */
export function createAuthService(db: PrismaClient): AuthService {
  return new AuthService(db);
}
