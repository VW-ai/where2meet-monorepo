/**
 * Session authentication hooks module.
 *
 * Provides Fastify preHandler hooks for cookie-based session verification.
 * Used for user account endpoints (dashboard, profile, etc.).
 * @module hooks/sessionAuth
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { User } from "@prisma/client";
import { UnauthorizedError } from "../types/errors.js";
import { createAuthService } from "../services/auth.js";
import { SESSION_COOKIE_NAME } from "../utils/session.js";

/**
 * Auth context attached to request after session verification.
 */
export interface UserAuthContext {
  /** Authenticated user's ID */
  userId: string;
  /** Full user object */
  user: User;
}

// Extend FastifyRequest to include user auth context
declare module "fastify" {
  interface FastifyRequest {
    userAuth?: UserAuthContext;
  }
}

/**
 * Creates a preHandler hook that requires a valid session.
 *
 * Extracts session token from cookie, validates it, and attaches
 * user info to the request object.
 * @returns Fastify preHandler hook
 * @example
 * fastify.get("/api/users/me", {
 *   preHandler: [createRequireSession()],
 *   handler: getMeHandler,
 * });
 */
export function createRequireSession() {
  return async function requireSessionHook(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    // Extract session token from cookie
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedError("Session required");
    }

    // Validate session
    const authService = createAuthService(request.server.db);
    const session = await authService.validateSession(sessionToken);

    // Attach user to request
    request.userAuth = {
      userId: session.user.id,
      user: session.user,
    };
  };
}
