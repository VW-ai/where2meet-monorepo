/**
 * Authentication hooks module.
 *
 * Provides Fastify preHandler hooks for token verification:
 * - organizerToken: Full access to event and participants
 * - participantToken: Self-access only
 * @module hooks/auth
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../types/errors.js";
import { createEventService } from "../services/event.js";
import { createParticipantService } from "../services/participant.js";
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
  /** Type of token used for authentication */
  authType: "organizer" | "participant";
  /** If authType is "participant", the authenticated participant's ID */
  authenticatedParticipantId?: string;
}

// Extend FastifyRequest to include auth context
declare module "fastify" {
  interface FastifyRequest {
    participantAuth?: ParticipantAuthContext;
  }
}

/**
 * Options for organizer token verification.
 */
interface VerifyOrganizerTokenOptions {
  /** If true, allows requests without token (self-registration mode) */
  optional?: boolean;
}

/**
 * Creates a preHandler hook that verifies the organizer token.
 *
 * @param options.optional - If true, allows requests without token
 * @returns Fastify preHandler hook
 *
 * @example
 * // Required token (event PATCH/DELETE)
 * fastify.patch("/api/events/:id", {
 *   preHandler: [verifyOrganizerToken()],
 *   handler: updateEventHandler,
 * });
 *
 * @example
 * // Optional token (participant POST - self-registration)
 * fastify.post("/api/events/:id/participants", {
 *   preHandler: [verifyOrganizerToken({ optional: true })],
 *   handler: addParticipantHandler,
 * });
 */
export function verifyOrganizerToken(options: VerifyOrganizerTokenOptions = {}) {
  const { optional = false } = options;

  return async function (
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

    // Verify organizerToken
    const eventService = createEventService(request.server.db);
    const isValid = await eventService.verifyOrganizerToken(eventId, token);

    if (!isValid) {
      throw new ForbiddenError("Invalid organizer token");
    }

    request.participantAuth = { authType: "organizer" };
  };
}

/**
 * Options for participant access verification.
 */
interface VerifyParticipantAccessOptions {
  /**
   * If true, even organizers can only access their own participant record.
   * Used for voting endpoints where organizer shouldn't vote on behalf of others.
   * Default: false (organizer has full access to any participant)
   */
  selfOnly?: boolean;
}

/**
 * Creates a preHandler hook that verifies either organizer or participant token.
 *
 * For PATCH/DELETE on /api/events/:id/participants/:participantId:
 * 1. Try organizerToken → full access to any participant (unless selfOnly)
 * 2. Try participantToken → self-access only (participantId must match)
 *
 * When selfOnly=true, organizer must also match the participantId:
 * - Organizer participant's tokenHash = organizerTokenHash
 * - URL participantId must match the organizer's participant ID
 *
 * Sets request.participantAuth with auth context for use in handlers.
 *
 * @param options.selfOnly - If true, organizer can only access their own participant
 * @returns Fastify preHandler hook
 *
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

    const eventService = createEventService(request.server.db);
    const participantService = createParticipantService(request.server.db);

    // Try as organizerToken first
    const isOrganizerValid = await eventService.verifyOrganizerToken(eventId, token);

    if (isOrganizerValid) {
      if (selfOnly) {
        // Organizer must match the participantId - verify via token hash
        // Organizer participant's tokenHash = organizerTokenHash
        const isAlsoParticipant = await participantService.verifyParticipantToken(
          participantId,
          token
        );
        if (!isAlsoParticipant) {
          throw new ForbiddenError("Organizer can only access their own participant record for this operation");
        }
      }
      request.participantAuth = {
        authType: "organizer",
        authenticatedParticipantId: participantId,
      };
      return;
    }

    // Try as participantToken (self-access only by nature)
    const isParticipantValid = await participantService.verifyParticipantToken(
      participantId,
      token
    );

    if (isParticipantValid) {
      request.participantAuth = {
        authType: "participant",
        authenticatedParticipantId: participantId,
      };
      return;
    }

    // Neither token is valid
    throw new ForbiddenError("Invalid token or insufficient permissions");
  };
}

/**
 * PreHandler hook that verifies either organizer or participant token.
 * This is the default hook where organizer has full access to any participant.
 *
 * @deprecated Use createVerifyParticipantAccess() for new code
 */
export const verifyParticipantAccess = createVerifyParticipantAccess();
