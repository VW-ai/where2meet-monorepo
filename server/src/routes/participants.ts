/**
 * Participant routes module.
 *
 * Provides API endpoints for participant CRUD operations.
 * Supports dual-token authentication:
 * - organizerToken: Full access to all participants
 * - participantToken: Self-access only (for PATCH/DELETE)
 * @module routes/participants
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createParticipantService } from "../services/participant.js";
import {
  CreateParticipantSchema,
  UpdateParticipantSchema,
  type CreateParticipantInput,
  type UpdateParticipantInput,
} from "../schemas/participant.js";
import { EventIdSchema } from "../schemas/event.js";
import { toParticipantResponse, toCreateParticipantResponse } from "../mappers/event.mapper.js";
import { createDeleteSuccessResponse } from "../dto/index.js";
import { verifyOrganizerToken, createVerifyParticipantAccess } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";
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
 *
 * Authentication:
 * - POST: Optional organizerToken (no auth = self-registration with participantToken)
 * - PATCH/DELETE: organizerToken (any participant) or participantToken (self only)
 */
export function participantRoutes(fastify: FastifyInstance): void {
  const participantService = createParticipantService(fastify.db);

  /**
   * POST /api/events/:id/participants
   * Adds a new participant to an event.
   *
   * Authentication modes:
   * - No auth: Self-registration, returns participantToken for self-management
   * - organizerToken: Organizer adds participant, no participantToken returned
   *
   * Fails if event is published.
   */
  fastify.post<{ Params: EventParams; Body: CreateParticipantInput }>(
    "/api/events/:id/participants",
    {
      preHandler: [verifyOrganizerToken({ optional: true })],
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
        participant: {
          id: result.participant.id,
          name: result.participant.name,
          address: result.participant.address,
          lat: result.participant.lat ? Number(result.participant.lat) : null,
          lng: result.participant.lng ? Number(result.participant.lng) : null,
          color: result.participant.color,
          isOrganizer: result.participant.isOrganizer,
        },
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
   * - organizerToken: Can update any participant
   * - participantToken: Can only update self
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

      const participant = await participantService.updateParticipant(
        request.params.id,
        request.params.participantId,
        bodyResult.data
      );
      const response = toParticipantResponse(participant);

      // Broadcast SSE event (non-blocking)
      const ssePayload: ParticipantUpdatedPayload = {
        participant: {
          id: participant.id,
          name: participant.name,
          address: participant.address,
          lat: participant.lat ? Number(participant.lat) : null,
          lng: participant.lng ? Number(participant.lng) : null,
          color: participant.color,
          isOrganizer: participant.isOrganizer,
        },
      };
      fastify.sse
        .broadcast({
          eventId: request.params.id,
          type: "participant:updated",
          payload: ssePayload,
        })
        .catch(() => {
          /* SSE broadcast failure is non-critical */
        });

      return reply.send(response);
    }
  );

  /**
   * DELETE /api/events/:id/participants/:participantId
   * Removes a participant from an event.
   *
   * Authentication:
   * - organizerToken: Can delete any participant
   * - participantToken: Can only delete self
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

      return reply.send(createDeleteSuccessResponse("Participant deleted successfully"));
    }
  );
}
