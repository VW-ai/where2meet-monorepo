/**
 * SSE (Server-Sent Events) routes module.
 *
 * Provides the stream endpoint for real-time event updates.
 * @module routes/sse
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createParticipantService } from "../services/participant.js";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../types/errors.js";
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
   * - Validates token belongs to a participant in the event
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

      // Verify token belongs to a participant in this event
      const participantService = createParticipantService(fastify.db);
      const authResult = await participantService.findParticipantByTokenWithDetails(eventId, token);

      if (!authResult) {
        throw new ForbiddenError("Invalid token");
      }

      const { participantId, isOrganizer } = authResult;

      // Set SSE headers with CORS support
      // When using reply.raw.writeHead(), we bypass Fastify's CORS plugin,
      // so we must manually add CORS headers for cross-origin SSE connections
      const origin = request.headers.origin;
      const headers: Record<string, string> = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      };

      // Add CORS headers if origin is present
      if (origin) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
      }

      reply.raw.writeHead(200, headers);

      // Register connection with SSE service
      const connectionId = await fastify.sse.addConnection(eventId, reply, {
        participantId,
        isOrganizer,
      });

      logger.info({ eventId, connectionId, isOrganizer, participantId }, "SSE stream connected");

      // Send initial heartbeat to confirm connection
      // Note: We don't send a "connected" event as it's not part of the SSE spec
      reply.raw.write(`event: heartbeat\n`);
      reply.raw.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

      // Keep the connection open - Fastify will handle the response
      // The connection cleanup happens in the SSE plugin when the client disconnects
      return reply;
    }
  );
}
