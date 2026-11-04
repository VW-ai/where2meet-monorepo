/**
 * Participant routes module.
 *
 * Provides API endpoints for participant CRUD operations.
 * Authentication is based on Participant.isOrganizer flag:
 * - Organizer (isOrganizer=true): Full access to all participants
 * - Non-organizer: Self-access only (for PATCH/DELETE)
 * @module routes/participants
 */

import type { Participant } from "@prisma/client";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createParticipantService } from "../services/participant.js";
import { createVoteService } from "../services/vote.js";
import {
  CreateParticipantSchema,
  UpdateParticipantSchema,
  type CreateParticipantInput,
  type UpdateParticipantInput,
} from "../schemas/participant.js";
import { EventIdSchema } from "../schemas/event.js";
import {
  toParticipantResponse,
  toCreateParticipantResponse,
  toPublicParticipant,
} from "../mappers/event.mapper.js";
import { toVoteStatisticsPayload } from "../mappers/vote.mapper.js";
import { createDeleteSuccessResponse } from "../dto/index.js";
import { createVerifyToken, createVerifyParticipantAccess } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";
import { validateEventId, validateParticipantId } from "../utils/auth.js";
import type {
  ParticipantAddedPayload,
  ParticipantUpdatedPayload,
  ParticipantRemovedPayload,
} from "../types/sse.js";

/**
 * Route parameter types.
 */
interface EventParams {
  id: string;
}

interface ParticipantParams extends EventParams {
  participantId: string;
}

/**
 * Registers participant routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/events/:id/participants - Add a participant
 * - PATCH /api/events/:id/participants/:participantId - Update a participant
 * - DELETE /api/events/:id/participants/:participantId - Remove a participant
 * - POST /api/events/:id/participants/:participantId/claim - Claim an added row
 * - DELETE /api/events/:id/participants/:participantId/claim - Undo a claim
 *
 * Authentication:
 * - POST: Optional token (no auth = self-registration with new participantToken)
 * - PATCH/DELETE: Organizer can access any participant, non-organizer only self
 * - Claim: No auth to claim, the row's own token to undo
 */
export function participantRoutes(fastify: FastifyInstance): void {
  const participantService = createParticipantService(fastify.db);
  const voteService = createVoteService(fastify.db);

  const broadcastParticipantUpdated = (eventId: string, participant: Participant): void => {
    const payload: ParticipantUpdatedPayload = { participant: toPublicParticipant(participant) };
    fastify.sse.broadcast({ eventId, type: "participant:updated", payload }).catch(() => {
      /* SSE broadcast failure is non-critical */
    });
  };

  const broadcastVoteStatistics = (eventId: string): void => {
    voteService
      .getVoteStatistics(eventId)
      .then((stats) =>
        fastify.sse.broadcast({
          eventId,
          type: "vote:statistics",
          payload: toVoteStatisticsPayload(eventId, stats),
        })
      )
      .catch(() => {
        /* SSE broadcast failure is non-critical */
      });
  };

  /**
   * POST /api/events/:id/participants
   * Adds a new participant to an event.
   *
   * Authentication modes:
   * - No auth: Self-registration, returns participantToken for self-management
   * - With token (isOrganizer=true): Organizer adds participant, no token returned
   *
   * Fails if event is published.
   */
  fastify.post<{ Params: EventParams; Body: CreateParticipantInput }>(
    "/api/events/:id/participants",
    {
      preHandler: [createVerifyToken({ optional: true, requireOrganizer: true })],
    },
    async (
      request: FastifyRequest<{ Params: EventParams; Body: CreateParticipantInput }>,
      reply: FastifyReply
    ) => {
      // Validate event ID
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      // Validate body
      const bodyResult = CreateParticipantSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      // Determine if this is self-registration (no auth) or organizer-created
      const isSelfRegistration = request.participantAuth === undefined;

      const result = await participantService.addParticipant(
        paramsResult.data.id,
        bodyResult.data,
        { generateToken: isSelfRegistration }
      );

      const response = toCreateParticipantResponse(result.participant, result.participantToken);

      // Broadcast SSE event (non-blocking)
      const ssePayload: ParticipantAddedPayload = {
        participant: toPublicParticipant(result.participant),
      };
      fastify.sse
        .broadcast({
          eventId: paramsResult.data.id,
          type: "participant:added",
          payload: ssePayload,
        })
        .catch(() => {
          /* SSE broadcast failure is non-critical */
        });

      return reply.status(201).send(response);
    }
  );

  /**
   * PATCH /api/events/:id/participants/:participantId
   * Updates a participant's details.
   *
   * Authentication:
   * - Organizer (isOrganizer=true): Can update any participant, except the
   *   travelMode of a row that holds its own token
   * - Non-organizer: Can only update self
   *
   * Fails if event is published.
   */
  fastify.patch<{ Params: ParticipantParams; Body: UpdateParticipantInput }>(
    "/api/events/:id/participants/:participantId",
    {
      preHandler: [createVerifyParticipantAccess()],
    },
    async (
      request: FastifyRequest<{ Params: ParticipantParams; Body: UpdateParticipantInput }>,
      reply: FastifyReply
    ) => {
      // Validate body (params already validated by auth hook)
      const bodyResult = UpdateParticipantSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const actor = request.participantAuth;
      if (!actor) {
        throw new ValidationError("Authentication required");
      }

      const participant = await participantService.updateParticipant(
        request.params.id,
        request.params.participantId,
        bodyResult.data,
        actor
      );
      const response = toParticipantResponse(participant);

      broadcastParticipantUpdated(request.params.id, participant);

      return reply.send(response);
    }
  );

  /**
   * DELETE /api/events/:id/participants/:participantId
   * Removes a participant from an event.
   *
   * Authentication:
   * - Organizer (isOrganizer=true): Can delete any participant
   * - Non-organizer: Can only delete self
   *
   * Fails if event is published.
   */
  fastify.delete<{ Params: ParticipantParams }>(
    "/api/events/:id/participants/:participantId",
    {
      preHandler: [createVerifyParticipantAccess()],
    },
    async (request: FastifyRequest<{ Params: ParticipantParams }>, reply: FastifyReply) => {
      // Params already validated by auth hook
      await participantService.deleteParticipant(request.params.id, request.params.participantId);

      // Broadcast SSE event (non-blocking)
      const ssePayload: ParticipantRemovedPayload = {
        participantId: request.params.participantId,
      };
      fastify.sse
        .broadcast({
          eventId: request.params.id,
          type: "participant:removed",
          payload: ssePayload,
        })
        .catch(() => {
          /* SSE broadcast failure is non-critical */
        });

      // The participant's votes went with them (cascade), so other tabs need a fresh snapshot.
      broadcastVoteStatistics(request.params.id);

      return reply.send(createDeleteSuccessResponse("Participant deleted successfully"));
    }
  );

  /**
   * POST /api/events/:id/participants/:participantId/claim
   * Takes over a row the organizer added ("That's me") and returns a token for it.
   *
   * Authentication: None. Anyone with the event link can claim, by design.
   *
   * Fails if event is published, or with 409 if the row is already claimed or is
   * the organizer's.
   */
  fastify.post<{ Params: ParticipantParams }>(
    "/api/events/:id/participants/:participantId/claim",
    async (request: FastifyRequest<{ Params: ParticipantParams }>, reply: FastifyReply) => {
      const { id: eventId, participantId } = request.params;
      validateEventId(eventId);
      validateParticipantId(participantId);

      const { participant, participantToken } = await participantService.claimParticipant(
        eventId,
        participantId
      );

      broadcastParticipantUpdated(eventId, participant);

      return reply.send(toCreateParticipantResponse(participant, participantToken));
    }
  );

  /**
   * DELETE /api/events/:id/participants/:participantId/claim
   * Gives a row back: the token stops working, and the row's votes are removed.
   *
   * Authentication: That participant's own token. An organizer token for another
   * row does not count, and the organizer's own row is refused.
   *
   * Fails if event is published.
   */
  fastify.delete<{ Params: ParticipantParams }>(
    "/api/events/:id/participants/:participantId/claim",
    {
      preHandler: [createVerifyParticipantAccess({ selfOnly: true })],
    },
    async (request: FastifyRequest<{ Params: ParticipantParams }>, reply: FastifyReply) => {
      const { id: eventId, participantId } = request.params;
      const participant = await participantService.unclaimParticipant(eventId, participantId);

      broadcastParticipantUpdated(eventId, participant);
      broadcastVoteStatistics(eventId);

      return reply.send(toParticipantResponse(participant));
    }
  );
}
