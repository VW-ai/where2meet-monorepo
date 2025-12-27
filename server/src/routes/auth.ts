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
  type RegisterInput,
  type LoginInput,
} from "../schemas/auth.js";
import { toUserResponse } from "../mappers/user.mapper.js";
import type { AuthResponse, LogoutResponse, SessionResponse } from "../dto/index.js";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from "../utils/session.js";
import { isProduction } from "../lib/config.js";
import { UnauthorizedError } from "../types/errors.js";

/**
 * Request types for route handlers.
 */
type RegisterRequest = FastifyRequest<{ Body: RegisterInput }>;
type LoginRequest = FastifyRequest<{ Body: LoginInput }>;

/**
 * Registers authentication routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/auth/register - Register a new user
 * - POST /api/auth/login - Login with email and password
 * - POST /api/auth/logout - Logout (invalidate session)
 * - GET /api/auth/session - Validate session and return user
 */
export function authRoutes(fastify: FastifyInstance): void {
  const authService = createAuthService(fastify.db);

  /**
   * POST /api/auth/register
   * Creates a new user account and returns user info with session cookie.
   */
  fastify.post("/api/auth/register", async (request: RegisterRequest, reply: FastifyReply) => {
    // Validate request body
    const parseResult = RegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { user, sessionToken } = await authService.register(parseResult.data);

    // Set session cookie
    void reply.setCookie(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions(isProduction));

    const response: AuthResponse = {
      user: toUserResponse(user),
    };

    return reply.status(201).send(response);
  });

  /**
   * POST /api/auth/login
   * Authenticates user and returns user info with session cookie.
   */
  fastify.post("/api/auth/login", async (request: LoginRequest, reply: FastifyReply) => {
    // Validate request body
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { email, password } = parseResult.data;
    const { user, sessionToken } = await authService.login(email, password);

    // Set session cookie
    void reply.setCookie(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions(isProduction));

    const response: AuthResponse = {
      user: toUserResponse(user),
    };

    return reply.send(response);
  });

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
    void reply.setCookie(
      SESSION_COOKIE_NAME,
      "",
      getClearSessionCookieOptions(isProduction)
    );

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
