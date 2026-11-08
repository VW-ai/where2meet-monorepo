/**
 * Directions routes module.
 *
 * Provides API endpoints for route calculation from participants to venues.
 * Uses mappers to transform route results to Response DTOs.
 * @module routes/directions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { TravelModeSchema } from "../dto/directions.dto.js";
import { createDirectionsService } from "../services/directions.js";
import { toDirectionsResponse } from "../mappers/directions.mapper.js";
import { createVerifyEventAccess } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";
import { RATE_LIMITS } from "../lib/rateLimits.js";

/**
 * Route parameters for directions endpoint.
 */
interface DirectionsParams {
  id: string; // eventId
  venueId: string;
}

/**
 * Query parameters for directions endpoint.
 */
interface DirectionsQuery {
  travelMode?: string;
  participantId?: string;
}

/**
 * Validation schema for route parameters.
 */
const DirectionsParamsSchema = z.object({
  id: z.string().regex(/^evt_/, "Invalid event ID format"),
  venueId: z.string().min(1, "Venue ID is required"),
});

/**
 * Validation schema for query parameters.
 */
const DirectionsQuerySchema = z.object({
  travelMode: TravelModeSchema.optional(),
  participantId: z.uuid().optional(),
});

/**
 * Request type for directions handler.
 */
type DirectionsRequest = FastifyRequest<{
  Params: DirectionsParams;
  Querystring: DirectionsQuery;
}>;

/**
 * Registers directions routes on the Fastify instance.
 *
 * Endpoints:
 * - GET /api/events/:id/venues/:venueId/directions - Calculate routes
 */
export function directionsRoutes(fastify: FastifyInstance): void {
  const directionsService = createDirectionsService(fastify.db);
  const verifyEventAccess = createVerifyEventAccess();

  /**
   * GET /api/events/:id/venues/:venueId/directions
   * Calculates routes for participants to a venue.
   *
   * Query Parameters:
   * - travelMode: driving | walking | transit | bicycling (optional - overrides everyone
   *   returned; omitted means each participant's own mode)
   * - participantId: UUID (optional - for single participant route)
   *
   * Authentication: Requires valid participant token
   */
  fastify.get(
    "/api/events/:id/venues/:venueId/directions",
    {
      config: RATE_LIMITS.maps,
      preHandler: [verifyEventAccess],
    },
    async (request: DirectionsRequest, reply: FastifyReply) => {
      // Validate params
      const paramsResult = DirectionsParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID or venue ID format");
      }

      // Validate query
      const queryResult = DirectionsQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new ValidationError("Invalid query parameters");
      }

      const { id: eventId, venueId } = paramsResult.data;
      const { travelMode, participantId } = queryResult.data;

      const routes = await directionsService.getDirections(
        eventId,
        venueId,
        travelMode,
        participantId
      );

      const response = toDirectionsResponse(venueId, travelMode ?? null, routes);

      return reply.send(response);
    }
  );
}
