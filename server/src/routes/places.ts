/**
 * Venue photo route.
 *
 * Clients load Google venue photos through here so the server key never
 * reaches them.
 * @module routes/places
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PHOTO_WIDTH, resolvePlacePhoto } from "../lib/places/index.js";
import { RATE_LIMITS } from "../lib/rateLimits.js";
import { NotFoundError, ValidationError } from "../types/errors.js";

const PhotoQuerySchema = z.object({
  ref: z
    .string()
    .min(1)
    .max(2000)
    .regex(/^[A-Za-z0-9_-]+$/),
  w: z.coerce.number().int().min(1).max(1600).default(PHOTO_WIDTH),
});

type PhotoRequest = FastifyRequest<{ Querystring: Record<string, string> }>;

/** Browsers and image caches keep a photo's location for a day. */
const PHOTO_CACHE_CONTROL = "public, max-age=86400";

/**
 * Registers the photo route.
 *
 * Endpoints:
 * - GET /api/places/photo?ref=...&w=... - Redirects to the photo image
 */
export function placesRoutes(fastify: FastifyInstance): void {
  fastify.get(
    "/api/places/photo",
    { config: RATE_LIMITS.maps },
    async (request: PhotoRequest, reply: FastifyReply) => {
      const parseResult = PhotoQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ValidationError("ref must be a Google photo reference");
      }
      const { ref, w } = parseResult.data;
      const location = await resolvePlacePhoto(ref, w);
      if (!location) {
        throw new NotFoundError("Photo");
      }
      return reply.header("Cache-Control", PHOTO_CACHE_CONTROL).redirect(location, 302);
    }
  );
}
