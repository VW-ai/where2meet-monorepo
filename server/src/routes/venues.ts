/**
 * Venue routes module.
 *
 * Provides API endpoints for venue search and details.
 * Uses mappers to transform Places API results to Response DTOs.
 * @module routes/venues
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createVenueService } from "../services/venue.js";
import {
  SearchVenuesSchema,
  VenueIdSchema,
  type SearchVenuesInput,
  type VenueIdParam,
} from "../schemas/venue.js";
import {
  toVenueSearchResponse,
  toVenueDetailsResponse,
} from "../mappers/venue.mapper.js";
import { ValidationError } from "../types/errors.js";

/**
 * Request types for route handlers.
 */
type SearchVenuesRequest = FastifyRequest<{ Body: SearchVenuesInput }>;
type GetVenueDetailsRequest = FastifyRequest<{ Params: VenueIdParam }>;

/**
 * Registers venue routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/venues/search - Search for venues near event MEC
 * - GET /api/venues/:id - Get venue details
 */
export function venueRoutes(fastify: FastifyInstance): void {
  const venueService = createVenueService(fastify.db);

  /**
   * POST /api/venues/search
   * Searches for venues near the event's MEC center.
   * No authentication required.
   */
  fastify.post(
    "/api/venues/search",
    async (request: SearchVenuesRequest, reply: FastifyReply) => {
      // Validate request body
      const parseResult = SearchVenuesSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { eventId, searchRadius, query, categories } = parseResult.data;

      const { places, searchCenter } = await venueService.searchVenues(
        eventId,
        searchRadius,
        { query, categories }
      );

      const response = toVenueSearchResponse(places, searchCenter);

      return reply.send(response);
    }
  );

  /**
   * GET /api/venues/:id
   * Returns detailed information about a venue.
   * No authentication required.
   */
  fastify.get(
    "/api/venues/:id",
    async (request: GetVenueDetailsRequest, reply: FastifyReply) => {
      // Validate params
      const parseResult = VenueIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid venue ID");
      }

      const details = await venueService.getVenueDetails(parseResult.data.id);
      const response = toVenueDetailsResponse(details);

      return reply.send(response);
    }
  );
}
