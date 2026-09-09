/**
 * Authentication hooks module.
 *
 * Provides Fastify preHandler hooks for token verification.
 * All participants (including organizer) use the same token format.
 * Authorization is determined by Participant.isOrganizer flag in database.
 * @module hooks/auth
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError, EventNotFoundError } from "../types/errors.js";
import { createParticipantService } from "../services/participant.js";
import { createEventRepository } from "../repositories/event.js";
import {
  extractBearerToken,
  requireBearerToken,
  validateEventId,
  validateParticipantId,
} from "../utils/auth.js";

/**
 * Auth context attached to request after verification.
 */
export interface ParticipantAuthContext {
  /** Authenticated participant's ID */
  participantId: string;
  /** Whether the participant is the organizer */
  isOrganizer: boolean;
}

// Extend FastifyRequest to include auth context
declare module "fastify" {
  interface FastifyRequest {
    participantAuth?: ParticipantAuthContext;
  }
}

/**
 * Options for token verification.
 */
interface VerifyTokenOptions {
  /** If true, allows requests without token (e.g., self-registration mode) */
  optional?: boolean;
  /** If true, requires the authenticated participant to be the organizer */
  requireOrganizer?: boolean;
}

/**
 * Creates a preHandler hook that verifies the participant token.
 *
 * All participants (including organizer) use the same token format.
 * Authorization is determined by checking Participant.isOrganizer in database.
 * @param options - Verification options
 * @param options.optional - If true, allows requests without token
 * @param options.requireOrganizer - If true, requires isOrganizer=true
 * @returns Fastify preHandler hook
 * @example
 * // Required token, organizer only (event PATCH/DELETE)
 * fastify.patch("/api/events/:id", {
 *   preHandler: [createVerifyToken({ requireOrganizer: true })],
 *   handler: updateEventHandler,
 * });
 * @example
 * // Optional token (participant POST - self-registration)
 * fastify.post("/api/events/:id/participants", {
 *   preHandler: [createVerifyToken({ optional: true })],
 *   handler: addParticipantHandler,
 * });
 */
export function createVerifyToken(options: VerifyTokenOptions = {}) {
  const { optional = false, requireOrganizer = false } = options;

  return async function verifyTokenHook(
    request: FastifyRequest<{ Params: { id: string } }>,
    _reply: FastifyReply
  ): Promise<void> {
    const token = optional
      ? extractBearerToken(request.headers.authorization)
      : requireBearerToken(request.headers.authorization);

    const eventId = request.params.id;
    validateEventId(eventId);

    // No token in optional mode = self-registration
    if (!token) {
      request.participantAuth = undefined;
      return;
    }

    // Check if event exists first (to return 404 instead of 403 for non-existent events)
    const eventRepo = createEventRepository(request.server.db);
    const eventExists = await eventRepo.exists(eventId);
    if (!eventExists) {
      throw new EventNotFoundError(eventId);
    }

    // Look up participant by token
    const participantService = createParticipantService(request.server.db);
    const authResult = await participantService.findParticipantByTokenWithDetails(eventId, token);

    if (!authResult) {
      throw new ForbiddenError("Invalid token");
    }

    // Check organizer requirement
    if (requireOrganizer && !authResult.isOrganizer) {
      throw new ForbiddenError("Organizer access required");
    }

    request.participantAuth = {
      participantId: authResult.participantId,
      isOrganizer: authResult.isOrganizer,
    };
  };
}

/**
 * Backwards compatibility alias for createVerifyToken({ requireOrganizer: true }).
 * @deprecated Use createVerifyToken({ requireOrganizer: true }) for new code
 */
export function verifyOrganizerToken(options: { optional?: boolean } = {}) {
  return createVerifyToken({ ...options, requireOrganizer: !options.optional });
}

/**
 * Options for participant access verification.
 */
interface VerifyParticipantAccessOptions {
  /**
   * If true, the authenticated participant can only access their own participant record.
   * Used for voting endpoints where participants shouldn't act on behalf of others.
   * Default: false (organizer has full access to any participant)
   */
  selfOnly?: boolean;
}

/**
 * Creates a preHandler hook that verifies participant access to a specific participant.
 *
 * For PATCH/DELETE on /api/events/:id/participants/:participantId:
 * - Organizers can access any participant (unless selfOnly=true)
 * - Non-organizers can only access their own participant record
 *
 * Sets request.participantAuth with auth context for use in handlers.
 * @param options - Access verification options
 * @param options.selfOnly - If true, even organizers can only access their own participant
 * @returns Fastify preHandler hook
 * @throws UnauthorizedError (401) if no token provided
 * @throws ForbiddenError (403) if token invalid or insufficient permissions
 */
export function createVerifyParticipantAccess(options: VerifyParticipantAccessOptions = {}) {
  const { selfOnly = false } = options;

  return async function verifyParticipantAccessHook(
    request: FastifyRequest<{ Params: { id: string; participantId: string } }>,
    _reply: FastifyReply
  ): Promise<void> {
    const token = requireBearerToken(request.headers.authorization);
    const { id: eventId, participantId } = request.params;

    validateEventId(eventId);
    validateParticipantId(participantId);

    // Check if event exists first (to return 404 instead of 403 for non-existent events)
    const eventRepo = createEventRepository(request.server.db);
    const eventExists = await eventRepo.exists(eventId);
    if (!eventExists) {
      throw new EventNotFoundError(eventId);
    }

    // Look up participant by token
    const participantService = createParticipantService(request.server.db);
    const authResult = await participantService.findParticipantByTokenWithDetails(eventId, token);

    if (!authResult) {
      throw new ForbiddenError("Invalid token");
    }

    // Check access permissions
    if (selfOnly) {
      // selfOnly mode: must be accessing own record
      if (authResult.participantId !== participantId) {
        throw new ForbiddenError("Can only access your own participant record for this operation");
      }
    } else {
      // Normal mode: organizers can access any participant, non-organizers only self
      if (!authResult.isOrganizer && authResult.participantId !== participantId) {
        throw new ForbiddenError("Insufficient permissions");
      }
    }

    request.participantAuth = {
      participantId: authResult.participantId,
      isOrganizer: authResult.isOrganizer,
    };
  };
}

/**
 * PreHandler hook that verifies either organizer or participant token.
 * This is the default hook where organizer has full access to any participant.
 * @deprecated Use createVerifyParticipantAccess() for new code
 */
export const verifyParticipantAccess = createVerifyParticipantAccess();

/**
 * Creates a preHandler hook that verifies event-level access.
 *
 * Unlike createVerifyParticipantAccess, this hook does NOT require a
 * participantId in the URL. It simply verifies the token belongs to
 * the event (any participant with a valid token).
 *
 * Used for endpoints like:
 * - GET /api/events/:id/venues/:venueId/directions
 *
 * Sets request.participantAuth with auth context for use in handlers.
 * @returns Fastify preHandler hook
 * @throws UnauthorizedError (401) if no token provided
 * @throws ForbiddenError (403) if token invalid
 * @example
 * fastify.get("/api/events/:id/venues/:venueId/directions", {
 *   preHandler: [createVerifyEventAccess()],
 *   handler: directionsHandler,
 * });
 */
export function createVerifyEventAccess() {
  return async function verifyEventAccessHook(
    request: FastifyRequest<{ Params: { id: string } }>,
    _reply: FastifyReply
  ): Promise<void> {
    const token = requireBearerToken(request.headers.authorization);
    const eventId = request.params.id;

    validateEventId(eventId);

    // Check if event exists first (to return 404 instead of 403 for non-existent events)
    const eventRepo = createEventRepository(request.server.db);
    const eventExists = await eventRepo.exists(eventId);
    if (!eventExists) {
      throw new EventNotFoundError(eventId);
    }

    // Look up participant by token
    const participantService = createParticipantService(request.server.db);
    const authResult = await participantService.findParticipantByTokenWithDetails(eventId, token);

    if (!authResult) {
      throw new ForbiddenError("Invalid token");
    }

    request.participantAuth = {
      participantId: authResult.participantId,
      isOrganizer: authResult.isOrganizer,
    };
  };
}
