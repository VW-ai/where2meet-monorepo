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
import type { GoogleIdentity } from "../lib/googleIdToken.js";

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
 * How a Google sign-in found its user: an account already linked to this
 * Google account, an email account it was just linked to, or a new account.
 */
export type GoogleSignInOutcome = "existing" | "linked" | "created";

/**
 * Result of a Google sign-in.
 */
export interface GoogleSignInResult extends AuthResult {
  outcome: GoogleSignInOutcome;
}

type TransactionClient = Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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
   * Signs in with a verified Google identity, linking or creating the account.
   *
   * A concurrent first sign-in for the same Google account or email loses the
   * unique-constraint race; one retry then finds the row the winner created.
   * @param identity - Identity proven by a verified Google ID token
   * @returns User, session token, and how the user was resolved
   * @throws UnauthorizedError if Google has not verified the email
   */
  async signInWithGoogle(identity: GoogleIdentity): Promise<GoogleSignInResult> {
    if (!identity.emailVerified) {
      throw new UnauthorizedError("Google email is not verified");
    }

    try {
      return await this.resolveGoogleSignIn(identity);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      logger.warn("Google sign-in raced another sign-in; retrying");
      return this.resolveGoogleSignIn(identity);
    }
  }

  private async resolveGoogleSignIn(identity: GoogleIdentity): Promise<GoogleSignInResult> {
    const { token: sessionToken, hash: sessionTokenHash } = generateSessionToken();
    const expiresAt = getSessionExpiresAt();
    const sessionId = generateSessionId();

    const { user, outcome } = await this.db.$transaction(async (tx) => {
      const resolved = await this.findOrCreateGoogleUser(tx, identity);
      await tx.userSession.create({
        data: {
          id: sessionId,
          userId: resolved.user.id,
          tokenHash: sessionTokenHash,
          expiresAt,
        },
      });
      return resolved;
    });

    logger.info({ userId: user.id, outcome }, "Google sign-in successful");
    return { user, sessionToken, outcome };
  }

  private async findOrCreateGoogleUser(
    tx: TransactionClient,
    identity: GoogleIdentity
  ): Promise<{ user: User; outcome: GoogleSignInOutcome }> {
    // providerId is Google's sub, not the email, so it is matched exactly.
    const existing = await tx.userIdentity.findUnique({
      where: { provider_providerId: { provider: "google", providerId: identity.sub } },
      include: { user: true },
    });
    if (existing) {
      return { user: existing.user, outcome: "existing" };
    }

    const email = identity.email.toLowerCase().trim();
    const emailUser = await tx.user.findUnique({ where: { email } });
    if (emailUser) {
      return { user: await this.linkGoogleIdentity(tx, emailUser, identity), outcome: "linked" };
    }

    const user = await tx.user.create({
      data: {
        id: generateUserId(),
        email,
        name: identity.name,
        avatarUrl: identity.picture,
        emailVerified: true,
      },
    });
    await this.createGoogleIdentity(tx, user.id, identity.sub);
    return { user, outcome: "created" };
  }

  private async linkGoogleIdentity(
    tx: TransactionClient,
    user: User,
    identity: GoogleIdentity
  ): Promise<User> {
    await this.createGoogleIdentity(tx, user.id, identity.sub);

    if (!user.emailVerified) {
      // Nobody proved they owned this address when the password was set, so it
      // may belong to someone squatting the owner's email. Google has now
      // proved ownership: drop the password and every session it opened.
      await tx.userIdentity.deleteMany({ where: { userId: user.id, provider: "email" } });
      await tx.userSession.deleteMany({ where: { userId: user.id } });
      logger.warn({ userId: user.id }, "Google sign-in took over unverified email account");
    }

    return tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        name: user.name ?? identity.name,
        avatarUrl: user.avatarUrl ?? identity.picture,
      },
    });
  }

  private async createGoogleIdentity(
    tx: TransactionClient,
    userId: string,
    sub: string
  ): Promise<void> {
    await tx.userIdentity.create({
      data: { id: generateIdentityId(), userId, provider: "google", providerId: sub },
    });
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
