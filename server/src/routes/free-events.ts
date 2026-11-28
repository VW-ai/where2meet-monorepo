/**
 * Free NYC events for the /nyc maps.
 * @module routes/free-events
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { RATE_LIMITS } from "../lib/rateLimits.js";
import { ValidationError } from "../types/errors.js";
import { FREE_EVENT_KINDS } from "../services/free-events/types.js";

const QuerySchema = z
  .object({
    kind: z.enum(FREE_EVENT_KINDS).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, { message: "from must not be after to" });

/** A map shows a week or two; this caps a wide `to` without paging. */
const MAX_EVENTS = 500;
/** The job writes once a day, so a few minutes of caching costs nothing. */
const CACHE_CONTROL = "public, max-age=300";

type FreeEventsRequest = FastifyRequest<{ Querystring: Record<string, string> }>;

/**
 * Registers the free events route.
 *
 * Endpoints:
 * - GET /api/free-events?kind=&from=&to= - Live events that have not ended, soonest first
 */
export function freeEventRoutes(fastify: FastifyInstance): void {
  fastify.get(
    "/api/free-events",
    { config: RATE_LIMITS.freeEvents },
    async (request: FreeEventsRequest, reply: FastifyReply) => {
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError(
          "kind must be free-food, hackathon or free-talk, and from and to must be dates"
        );
      }
      const { kind, from, to } = parsed.data;
      const now = new Date();
      const notEndedBy = from && from > now ? from : now;
      const rows = await fastify.db.freeEvent.findMany({
        where: {
          status: "live",
          ...(kind ? { kind } : {}),
          ...(to ? { startsAt: { lte: to } } : {}),
          OR: [{ endsAt: { gte: notEndedBy } }, { endsAt: null, startsAt: { gte: notEndedBy } }],
        },
        orderBy: { startsAt: "asc" },
        take: MAX_EVENTS,
      });
      const events = rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt?.toISOString() ?? null,
        venueName: row.venueName,
        placeId: row.placeId,
        lat: row.lat === null ? null : Number(row.lat),
        lng: row.lng === null ? null : Number(row.lng),
        url: row.url,
        source: row.source,
      }));
      return reply.header("Cache-Control", CACHE_CONTROL).send({ events });
    }
  );
}
