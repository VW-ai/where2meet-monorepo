/**
 * Vote routes module.
 *
 * Provides API endpoints for voting operations.
 * Supports dual-token authentication:
 * - organizerToken: Can vote on behalf of any participant
 * - participantToken: Can only vote for themselves
 * @module routes/votes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createVoteService } from "../services/vote.js";
import { createEventService } from "../services/event.js";
import { createParticipantService } from "../services/participant.js";
import {
  CastVoteSchema,
  RemoveVoteSchema,
  type CastVoteInput,
  type RemoveVoteInput,
} from "../schemas/vote.js";
import { EventIdSchema } from "../schemas/event.js";
import {
  toVoteResponse,
  toVoteStatisticsResponse,
  toVoteRemovalResponse,
} from "../mappers/vote.mapper.js";
import { requireBearerToken } from "../utils/auth.js";
import { ValidationError, ForbiddenError } from "../types/errors.js";

/**
 * Route parameter types.
 */
interface EventParams {
  id: string;
}

/**
 * Registers vote routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/events/:id/votes - Cast a vote
 * - DELETE /api/events/:id/votes - Remove a vote
 * - GET /api/events/:id/votes - Get vote statistics
 *
 * Authentication:
 * - POST/DELETE: REQUIRED - organizerToken (any participant) or participantToken (self only)
 * - GET: None (public vote statistics)
 */
export function voteRoutes(fastify: FastifyInstance): void {
  const voteService = createVoteService(fastify.db);
  const eventService = createEventService(fastify.db);
  const participantService = createParticipantService(fastify.db);

  /**
   * POST /api/events/:id/votes
   * Casts a vote for a venue in an event.
   *
   * Authentication:
   * - REQUIRED - organizerToken OR participantToken
   * - participantToken: Can only vote for themselves (participantId must match)
   * - organizerToken: Can vote on behalf of any participant
   *
   * Transaction: Atomically verifies event/participant and upserts venue+vote.
   * Idempotent: Duplicate votes return existing vote (no error).
   */
  fastify.post<{ Params: EventParams; Body: CastVoteInput }>(
    "/api/events/:id/votes",
    async (
      request: FastifyRequest<{ Params: EventParams; Body: CastVoteInput }>,
      reply: FastifyReply
    ) => {
      // Validate event ID
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      // Validate body
      const bodyResult = CastVoteSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const eventId = paramsResult.data.id;
      const { participantId, venueId, venueData } = bodyResult.data;

      // Require authentication token
      const token = requireBearerToken(request.headers.authorization);

      // Try organizerToken first (can vote for any participant)
      const isOrganizerValid = await eventService.verifyOrganizerToken(eventId, token);

      if (!isOrganizerValid) {
        // Try participantToken (can only vote for themselves)
        const isParticipantValid = await participantService.verifyParticipantToken(
          participantId,
          token
        );

        if (!isParticipantValid) {
          throw new ForbiddenError("Invalid token or insufficient permissions");
        }

        // Participant token is valid, but verify they're voting for themselves
        // (participantId from body must match the authenticated participant)
        // This is already enforced by verifyParticipantToken - if token is valid
        // for participantId, then they can vote for themselves
      }

      // Build complete venue data with ID
      const completeVenueData = {
        id: venueId,
        name: venueData.name,
        address: venueData.address ?? null,
        lat: venueData.lat,
        lng: venueData.lng,
        category: venueData.category ?? null,
        rating: venueData.rating ?? null,
        priceLevel: venueData.priceLevel ?? null,
        photoUrl: venueData.photoUrl ?? null,
      };

      // Cast vote (transactional: verify event → upsert venue → insert vote)
      const vote = await voteService.castVote(
        eventId,
        participantId,
        venueId,
        completeVenueData
      );

      const response = toVoteResponse(vote);

      return reply.code(201).send(response);
    }
  );

  /**
   * DELETE /api/events/:id/votes
   * Removes a vote for a venue in an event.
   *
   * Authentication:
   * - REQUIRED - organizerToken OR participantToken
   * - participantToken: Can only remove their own votes
   * - organizerToken: Can remove any participant's vote
   *
   * Idempotent: No error if vote doesn't exist.
   */
  fastify.delete<{ Params: EventParams; Body: RemoveVoteInput }>(
    "/api/events/:id/votes",
    async (
      request: FastifyRequest<{ Params: EventParams; Body: RemoveVoteInput }>,
      reply: FastifyReply
    ) => {
      // Validate event ID
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      // Validate body
      const bodyResult = RemoveVoteSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const eventId = paramsResult.data.id;
      const { participantId, venueId } = bodyResult.data;

      // Require authentication token
      const token = requireBearerToken(request.headers.authorization);

      // Try organizerToken first (can remove any vote)
      const isOrganizerValid = await eventService.verifyOrganizerToken(eventId, token);

      if (!isOrganizerValid) {
        // Try participantToken (can only remove own votes)
        const isParticipantValid = await participantService.verifyParticipantToken(
          participantId,
          token
        );

        if (!isParticipantValid) {
          throw new ForbiddenError("Invalid token or insufficient permissions");
        }

        // Participant token is valid and matches participantId
        // They can remove their own vote
      }

      // Remove vote (idempotent)
      const deleted = await voteService.removeVote(eventId, participantId, venueId);

      const response = toVoteRemovalResponse(deleted);

      return reply.code(200).send(response);
    }
  );

  /**
   * GET /api/events/:id/votes
   * Gets vote statistics for an event.
   *
   * Returns aggregated vote counts and voter lists per venue.
   * No authentication required (public statistics).
   */
  fastify.get<{ Params: EventParams }>(
    "/api/events/:id/votes",
    async (request: FastifyRequest<{ Params: EventParams }>, reply: FastifyReply) => {
      // Validate event ID
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      const eventId = paramsResult.data.id;

      // Get vote statistics (JOIN vote + venue tables)
      const stats = await voteService.getVoteStatistics(eventId);

      const response = toVoteStatisticsResponse(stats);

      return reply.code(200).send(response);
    }
  );
}
