/**
 * Authentication routes module.
 *
 * Provides API endpoints for user registration, login, logout, and session validation.
 * Uses HttpOnly cookies for session management.
 * @module routes/auth
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createAuthService } from "../services/auth.js";
import {
  RegisterSchema,
  LoginSchema,
  GoogleSignInSchema,
  type RegisterInput,
  type LoginInput,
  type GoogleSignInInput,
} from "../schemas/auth.js";
import { toUserResponse } from "../mappers/user.mapper.js";
import type { AuthResponse, LogoutResponse, SessionResponse } from "../dto/index.js";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from "../utils/session.js";
import { isProduction } from "../lib/config.js";
import { AppError, UnauthorizedError } from "../types/errors.js";
import { RATE_LIMITS } from "../lib/rateLimits.js";
import type { GoogleIdTokenVerifier } from "../lib/googleIdToken.js";

/**
 * Request types for route handlers.
 */
type RegisterRequest = FastifyRequest<{ Body: RegisterInput }>;
type LoginRequest = FastifyRequest<{ Body: LoginInput }>;
type GoogleSignInRequest = FastifyRequest<{ Body: GoogleSignInInput }>;

/**
 * Options for the auth routes plugin.
 */
export interface AuthRoutesOptions {
  /** Verifies Google ID tokens; null when Google sign-in is not configured. */
  googleVerifier?: GoogleIdTokenVerifier | null;
}

/**
 * Registers authentication routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/auth/register - Register a new user
 * - POST /api/auth/login - Login with email and password
 * - POST /api/auth/google - Sign in with a Google ID token
 * - POST /api/auth/logout - Logout (invalidate session)
 * - GET /api/auth/session - Validate session and return user
 */
export function authRoutes(fastify: FastifyInstance, options: AuthRoutesOptions): void {
  const authService = createAuthService(fastify.db);
  const googleVerifier = options.googleVerifier ?? null;

  /**
   * POST /api/auth/register
   * Creates a new user account and returns user info with session cookie.
   */
  fastify.post(
    "/api/auth/register",
    { config: RATE_LIMITS.auth },
    async (request: RegisterRequest, reply: FastifyReply) => {
      // Validate request body
      const parseResult = RegisterSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { user, sessionToken } = await authService.register(parseResult.data);

      // Set session cookie
      void reply.setCookie(
        SESSION_COOKIE_NAME,
        sessionToken,
        getSessionCookieOptions(isProduction)
      );

      const response: AuthResponse = {
        user: toUserResponse(user),
      };

      return reply.status(201).send(response);
    }
  );

  /**
   * POST /api/auth/login
   * Authenticates user and returns user info with session cookie.
   */
  fastify.post(
    "/api/auth/login",
    { config: RATE_LIMITS.auth },
    async (request: LoginRequest, reply: FastifyReply) => {
      // Validate request body
      const parseResult = LoginSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { email, password } = parseResult.data;
      const { user, sessionToken } = await authService.login(email, password);

      // Set session cookie
      void reply.setCookie(
        SESSION_COOKIE_NAME,
        sessionToken,
        getSessionCookieOptions(isProduction)
      );

      const response: AuthResponse = {
        user: toUserResponse(user),
      };

      return reply.send(response);
    }
  );

  /**
   * POST /api/auth/google
   * Signs in with a Google ID token, creating or linking the account.
   * Replies 201 when a new account was created.
   */
  fastify.post(
    "/api/auth/google",
    { config: RATE_LIMITS.auth },
    async (request: GoogleSignInRequest, reply: FastifyReply) => {
      if (!googleVerifier) {
        throw new AppError("Google sign-in is not configured", 503, "GOOGLE_SIGNIN_DISABLED");
      }

      const parseResult = GoogleSignInSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const identity = await googleVerifier(parseResult.data.credential);
      const { user, sessionToken, outcome } = await authService.signInWithGoogle(identity);

      void reply.setCookie(
        SESSION_COOKIE_NAME,
        sessionToken,
        getSessionCookieOptions(isProduction)
      );

      const response: AuthResponse = {
        user: toUserResponse(user),
      };

      return reply.status(outcome === "created" ? 201 : 200).send(response);
    }
  );

  /**
   * POST /api/auth/logout
   * Invalidates the current session.
   */
  fastify.post("/api/auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (sessionToken) {
      await authService.logout(sessionToken);
    }

    // Clear session cookie
    void reply.setCookie(SESSION_COOKIE_NAME, "", getClearSessionCookieOptions(isProduction));

    const response: LogoutResponse = {
      success: true,
    };

    return reply.send(response);
  });

  /**
   * GET /api/auth/session
   * Validates the current session and returns user info.
   */
  fastify.get("/api/auth/session", async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedError("Session required");
    }

    const session = await authService.validateSession(sessionToken);

    const response: SessionResponse = {
      user: toUserResponse(session.user),
    };

    return reply.send(response);
  });
}
