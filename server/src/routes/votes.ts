/**
 * Vote routes module.
 *
 * Provides API endpoints for voting operations.
 * Uses selfOnly authentication: participants can only vote for themselves.
 * @module routes/votes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { createVoteService } from "../services/vote.js";
import { VenueDataSchema } from "../schemas/vote.js";
import { EventIdSchema } from "../schemas/event.js";
import {
  toVoteResponse,
  toVoteStatisticsResponse,
  toVoteRemovalResponse,
} from "../mappers/vote.mapper.js";
import { createVerifyParticipantAccess } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";
import type { VoteStatisticsPayload } from "../types/sse.js";

/**
 * Route parameter types.
 */
interface EventParams {
  id: string;
}

interface VoteParams extends EventParams {
  participantId: string;
}

interface RemoveVoteParams extends VoteParams {
  venueId: string;
}

/**
 * Schema for cast vote request body (participantId now in URL).
 */
const CastVoteBodySchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  venueData: VenueDataSchema,
});

type CastVoteBody = z.infer<typeof CastVoteBodySchema>;

/**
 * Schema for vote params validation.
 */
const VoteParamsSchema = z.object({
  id: z.string().regex(/^evt_/, "Invalid event ID format"),
  participantId: z.uuid("Invalid participant ID format"),
});

/**
 * Schema for remove vote params validation.
 */
const RemoveVoteParamsSchema = VoteParamsSchema.extend({
  venueId: z.string().min(1, "Venue ID is required"),
});

/**
 * Registers vote routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/events/:id/participants/:participantId/votes - Cast a vote
 * - DELETE /api/events/:id/participants/:participantId/votes/:venueId - Remove a vote
 * - GET /api/events/:id/votes - Get vote statistics (public)
 *
 * Authentication:
 * - POST/DELETE: REQUIRED with selfOnly - token must match participantId
 * - GET: None (public vote statistics)
 */
export function voteRoutes(fastify: FastifyInstance): void {
  const voteService = createVoteService(fastify.db);

  // Create selfOnly hook - participants can only vote for themselves
  const verifySelfOnly = createVerifyParticipantAccess({ selfOnly: true });

  /**
   * POST /api/events/:id/participants/:participantId/votes
   * Casts a vote for a venue in an event.
   *
   * Authentication:
   * - REQUIRED - organizerToken OR participantToken
   * - selfOnly: Token must match the participantId in URL
   *
   * Transaction: Atomically verifies event/participant and upserts venue+vote.
   * Idempotent: Duplicate votes return existing vote (no error).
   */
  fastify.post<{ Params: VoteParams; Body: CastVoteBody }>(
    "/api/events/:id/participants/:participantId/votes",
    {
      preHandler: [verifySelfOnly],
    },
    async (
      request: FastifyRequest<{ Params: VoteParams; Body: CastVoteBody }>,
      reply: FastifyReply
    ) => {
      // Validate params
      const paramsResult = VoteParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID or participant ID format");
      }

      // Validate body
      const bodyResult = CastVoteBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const { id: eventId, participantId } = paramsResult.data;
      const { venueId, venueData } = bodyResult.data;

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

      // Broadcast updated vote statistics (non-blocking)
      voteService.getVoteStatistics(eventId).then((stats) => {
        const ssePayload: VoteStatisticsPayload = {
          venues: stats.map((stat) => ({
            venueId: stat.venue.id,
            voteCount: stat.voteCount,
            voterNames: stat.voterIds,
          })),
          totalVotes: stats.reduce((sum, stat) => sum + stat.voteCount, 0),
        };
        fastify.sse.broadcast({
          eventId,
          type: "vote:statistics",
          payload: ssePayload,
        }).catch(() => { /* SSE broadcast failure is non-critical */ });
      }).catch(() => { /* Stats fetch failure is non-critical for SSE */ });

      return reply.code(201).send(response);
    }
  );

  /**
   * DELETE /api/events/:id/participants/:participantId/votes/:venueId
   * Removes a vote for a venue in an event.
   *
   * Authentication:
   * - REQUIRED - organizerToken OR participantToken
   * - selfOnly: Token must match the participantId in URL
   *
   * Idempotent: No error if vote doesn't exist.
   */
  fastify.delete<{ Params: RemoveVoteParams }>(
    "/api/events/:id/participants/:participantId/votes/:venueId",
    {
      preHandler: [verifySelfOnly],
    },
    async (
      request: FastifyRequest<{ Params: RemoveVoteParams }>,
      reply: FastifyReply
    ) => {
      // Validate params
      const paramsResult = RemoveVoteParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID, participant ID, or venue ID format");
      }

      const { id: eventId, participantId, venueId } = paramsResult.data;

      // Remove vote (idempotent)
      const deleted = await voteService.removeVote(eventId, participantId, venueId);

      const response = toVoteRemovalResponse(deleted);

      // Broadcast updated vote statistics (non-blocking)
      voteService.getVoteStatistics(eventId).then((stats) => {
        const ssePayload: VoteStatisticsPayload = {
          venues: stats.map((stat) => ({
            venueId: stat.venue.id,
            voteCount: stat.voteCount,
            voterNames: stat.voterIds,
          })),
          totalVotes: stats.reduce((sum, stat) => sum + stat.voteCount, 0),
        };
        fastify.sse.broadcast({
          eventId,
          type: "vote:statistics",
          payload: ssePayload,
        }).catch(() => { /* SSE broadcast failure is non-critical */ });
      }).catch(() => { /* Stats fetch failure is non-critical for SSE */ });

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
