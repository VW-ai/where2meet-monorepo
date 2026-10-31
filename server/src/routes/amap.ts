/**
 * AMap lookup routes.
 *
 * China events cannot call Google from the browser, so the client asks the
 * server for autocomplete and reverse geocoding. Keeping these calls on the
 * server also keeps the AMap Web Service key private.
 * @module routes/amap
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  AmapSuggestQuerySchema,
  AmapReverseGeocodeQuerySchema,
  type AmapSuggestQuery,
  type AmapReverseGeocodeQuery,
} from "../schemas/amap.js";
import { suggestPlaces, reverseGeocodePoint } from "../services/amap.js";
import { toAmapSuggestResponse, toAmapReverseGeocodeResponse } from "../mappers/amap.mapper.js";
import { ValidationError } from "../types/errors.js";

type SuggestRequest = FastifyRequest<{ Querystring: AmapSuggestQuery }>;
type ReverseGeocodeRequest = FastifyRequest<{ Querystring: AmapReverseGeocodeQuery }>;

/**
 * Suggestions use AMap's small search quota (5,000 calls a month on a personal
 * key), so each client gets far fewer than the global limit. Applies when the
 * rate-limit plugin is registered (production).
 */
const SUGGEST_RATE_LIMIT = { rateLimit: { max: 60, timeWindow: 60_000 } };

/**
 * Registers AMap lookup routes on the Fastify instance.
 *
 * Endpoints:
 * - GET /api/amap/suggest - Autocomplete places
 * - GET /api/amap/reverse-geocode - Address at a point
 */
export function amapRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/amap/suggest?q=...&lat=...&lng=...
   * No authentication required.
   */
  fastify.get(
    "/api/amap/suggest",
    { config: SUGGEST_RATE_LIMIT },
    async (request: SuggestRequest, reply: FastifyReply) => {
      const parseResult = AmapSuggestQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.issues[0]?.message ?? "Invalid query");
      }
      const { q, lat, lng } = parseResult.data;
      const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
      const suggestions = await suggestPlaces(q, near);
      return reply.send(toAmapSuggestResponse(suggestions));
    }
  );

  /**
   * GET /api/amap/reverse-geocode?lat=...&lng=...
   * No authentication required.
   */
  fastify.get(
    "/api/amap/reverse-geocode",
    async (request: ReverseGeocodeRequest, reply: FastifyReply) => {
      const parseResult = AmapReverseGeocodeQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ValidationError("lat and lng are required");
      }
      const location = parseResult.data;
      const { formattedAddress } = await reverseGeocodePoint(location);
      return reply.send(toAmapReverseGeocodeResponse(formattedAddress, location));
    }
  );
}
