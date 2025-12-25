/**
 * SSE (Server-Sent Events) routes module.
 *
 * Provides the stream endpoint for real-time event updates.
 * @module routes/sse
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createEventService } from "../services/event.js";
import { createParticipantService } from "../services/participant.js";
import {
  EventNotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../types/errors.js";
import { createLogger } from "../lib/logger.js";
import { EventIdSchema } from "../schemas/event.js";
import { extractBearerToken } from "../utils/auth.js";

const logger = createLogger("SSERoutes");

/**
 * Use the standard event ID schema for params validation.
 */
const StreamParamsSchema = EventIdSchema;

/**
 * Route parameter types.
 */
interface StreamParams {
  id: string;
}

/**
 * Registers SSE routes on the Fastify instance.
 *
 * Endpoints:
 * - GET /api/events/:id/stream - Subscribe to real-time updates (requires Authorization header)
 */
export function sseRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/events/:id/stream
   * Subscribes to real-time updates for an event.
   *
   * Authentication:
   * - Token provided via Authorization header (Bearer token)
   * - Accepts organizerToken or participantToken
   * - Validates token belongs to the event
   *
   * Headers:
   * - Content-Type: text/event-stream
   * - Cache-Control: no-cache
   * - Connection: keep-alive
   * - X-Accel-Buffering: no (for nginx proxy)
   */
  fastify.get<{ Params: StreamParams }>(
    "/api/events/:id/stream",
    async (request: FastifyRequest<{ Params: StreamParams }>, reply: FastifyReply) => {
      // Validate params
      const paramsResult = StreamParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }
      const eventId = paramsResult.data.id;

      // Extract token from Authorization header
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        throw new UnauthorizedError("Authorization header with Bearer token is required");
      }

      // Verify event exists
      const eventService = createEventService(fastify.db);
      const participantService = createParticipantService(fastify.db);

      let isOrganizer = false;
      let participantId: string | undefined;

      // Try as organizer token first
      try {
        const isOrganizerValid = await eventService.verifyOrganizerToken(eventId, token);
        if (isOrganizerValid) {
          isOrganizer = true;
          // Get organizer's participant ID for tracking
          const event = await eventService.getEvent(eventId);
          const organizerParticipant = event.participants.find((p) => p.isOrganizer);
          participantId = organizerParticipant?.id;
        }
      } catch (error) {
        if (error instanceof EventNotFoundError) {
          throw error;
        }
        // Continue to try participant token
      }

      // If not organizer, try as participant token
      if (!isOrganizer) {
        const foundParticipantId = await participantService.findParticipantByToken(eventId, token);
        if (!foundParticipantId) {
          throw new ForbiddenError("Invalid token");
        }
        participantId = foundParticipantId;
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      // Register connection with SSE service
      const connectionId = await fastify.sse.addConnection(eventId, reply, {
        participantId,
        isOrganizer,
      });

      logger.info({ eventId, connectionId, isOrganizer, participantId }, "SSE stream connected");

      // Send initial connection event
      reply.raw.write(`event: connected\n`);
      reply.raw.write(`data: ${JSON.stringify({ connectionId, eventId })}\n\n`);

      // Keep the connection open - Fastify will handle the response
      // The connection cleanup happens in the SSE plugin when the client disconnects
      return reply;
    }
  );
}
