/**
 * Event routes module.
 *
 * Provides API endpoints for event CRUD operations.
 * Uses mappers to transform entities to Response DTOs.
 * @module routes/events
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createEventService } from "../services/event.js";
import { createParticipantService } from "../services/participant.js";
import {
  CreateEventSchema,
  UpdateEventSchema,
  EventIdSchema,
  PublishEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
  type EventIdParam,
  type PublishEventInput,
} from "../schemas/event.js";
import {
  toEventResponse,
  toCreateEventResponse,
  toGetMECResponse,
} from "../mappers/event.mapper.js";
import { createDeleteSuccessResponse } from "../dto/index.js";
import { createVerifyToken } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";
import type { EventUpdatedPayload, EventPublishedPayload } from "../types/sse.js";
import type { ParticipantMeResponse } from "../dto/participant.dto.js";
import { createVenueService } from "../services/venue.js";

/**
 * Request types for route handlers.
 */
type CreateEventRequest = FastifyRequest<{ Body: CreateEventInput }>;
type GetEventRequest = FastifyRequest<{ Params: EventIdParam }>;

/**
 * Registers event routes on the Fastify instance.
 *
 * Endpoints:
 * - POST /api/events - Create a new event
 * - GET /api/events/:id - Get event details
 * - GET /api/events/:id/mec - Get MEC (Minimum Enclosing Circle) for event
 * - PATCH /api/events/:id - Update event (requires auth)
 * - DELETE /api/events/:id - Delete event (requires auth)
 * - POST /api/events/:id/publish - Publish event with venue (requires auth)
 * - DELETE /api/events/:id/publish - Unpublish event (requires auth)
 */
export function eventRoutes(fastify: FastifyInstance): void {
  const eventService = createEventService(fastify.db);

  /**
   * POST /api/events
   * Creates a new event and returns it with the participantToken for the organizer.
   */
  fastify.post("/api/events", async (request: CreateEventRequest, reply: FastifyReply) => {
    // Validate request body
    const parseResult = CreateEventSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const { event, participantToken, organizerParticipantId } = await eventService.createEvent(
      parseResult.data
    );
    const response = toCreateEventResponse(event, participantToken, organizerParticipantId);

    return reply.status(201).send(response);
  });

  /**
   * GET /api/events/:id
   * Returns event details (tokens are never included in GET).
   */
  fastify.get("/api/events/:id", async (request: GetEventRequest, reply: FastifyReply) => {
    // Validate params
    const parseResult = EventIdSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new ValidationError("Invalid event ID format");
    }

    const event = await eventService.getEvent(parseResult.data.id);
    const response = toEventResponse(event);

    return reply.send(response);
  });

  /**
   * GET /api/events/:id/me
   * Returns the authenticated user's participant info.
   * Used by frontend to determine user's role after page refresh.
   */
  fastify.get<{ Params: EventIdParam }>(
    "/api/events/:id/me",
    {
      preHandler: [createVerifyToken()],
    },
    async (request, reply) => {
      // Validate params
      const parseResult = EventIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      const eventId = parseResult.data.id;
      const { participantId, isOrganizer } = request.participantAuth!;

      // Get full participant details
      const participantService = createParticipantService(fastify.db);
      const participant = await participantService.getParticipant(eventId, participantId);

      const response: ParticipantMeResponse = {
        participantId: participant.id,
        name: participant.name,
        isOrganizer,
        color: participant.color,
        address: participant.address,
        lat: participant.lat ? Number(participant.lat) : null,
        lng: participant.lng ? Number(participant.lng) : null,
      };

      return reply.send(response);
    }
  );

  /**
   * GET /api/events/:id/mec
   * Returns the Minimum Enclosing Circle for the event's participants.
   * Returns null center/radius if no participants have valid locations.
   */
  fastify.get("/api/events/:id/mec", async (request: GetEventRequest, reply: FastifyReply) => {
    // Validate params
    const parseResult = EventIdSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new ValidationError("Invalid event ID format");
    }

    const mecResult = await eventService.getMEC(parseResult.data.id);
    const response = toGetMECResponse(mecResult);

    return reply.send(response);
  });

  /**
   * PATCH /api/events/:id
   * Updates event fields. Requires organizer access.
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateEventInput }>(
    "/api/events/:id",
    {
      preHandler: [createVerifyToken({ requireOrganizer: true })],
    },
    async (request, reply) => {
      // Validate params
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      // Validate body
      const bodyResult = UpdateEventSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const event = await eventService.updateEvent(paramsResult.data.id, bodyResult.data);
      const response = toEventResponse(event);

      // Broadcast SSE event (non-blocking)
      const ssePayload: EventUpdatedPayload = {
        event: {
          id: event.id,
          title: event.title,
          meetingTime: event.meetingTime?.toISOString() ?? null,
          publishedAt: event.publishedAt?.toISOString() ?? null,
          publishedVenueId: event.publishedVenueId,
        },
      };
      fastify.sse
        .broadcast({
          eventId: event.id,
          type: "event:updated",
          payload: ssePayload,
        })
        .catch(() => {
          /* SSE broadcast failure is non-critical */
        });

      return reply.send(response);
    }
  );

  /**
   * DELETE /api/events/:id
   * Deletes an event. Requires organizer access.
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/events/:id",
    {
      preHandler: [createVerifyToken({ requireOrganizer: true })],
    },
    async (request, reply) => {
      // Validate params
      const parseResult = EventIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      await eventService.deleteEvent(parseResult.data.id);

      return reply.send(createDeleteSuccessResponse("Event deleted successfully"));
    }
  );

  /**
   * POST /api/events/:id/publish
   * Publishes an event with the selected venue. Requires organizer access.
   */
  fastify.post<{ Params: { id: string }; Body: PublishEventInput }>(
    "/api/events/:id/publish",
    {
      preHandler: [createVerifyToken({ requireOrganizer: true })],
    },
    async (request, reply) => {
      // Validate params
      const paramsResult = EventIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      // Validate body
      const bodyResult = PublishEventSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }

      const event = await eventService.publishEvent(paramsResult.data.id, bodyResult.data.venueId);
      const response = toEventResponse(event);

      // Broadcast SSE event:published (non-blocking)
      // Fetch venue details for the published venue
      const venueService = createVenueService(fastify.db);
      venueService
        .getVenueDetails(bodyResult.data.venueId)
        .then((venue) => {
          const ssePayload: EventPublishedPayload = {
            event: {
              id: event.id,
              title: event.title,
              meetingTime: event.meetingTime?.toISOString() ?? null,
              publishedAt: event.publishedAt?.toISOString() ?? new Date().toISOString(),
              publishedVenueId: event.publishedVenueId ?? bodyResult.data.venueId,
            },
            venue: {
              id: venue.placeId,
              name: venue.name,
              address: venue.address,
              lat: venue.location.lat,
              lng: venue.location.lng,
            },
          };
          fastify.sse
            .broadcast({
              eventId: event.id,
              type: "event:published",
              payload: ssePayload,
            })
            .catch(() => {
              /* SSE broadcast failure is non-critical */
            });
        })
        .catch(() => {
          /* Venue fetch failure is non-critical for SSE */
        });

      return reply.send(response);
    }
  );

  /**
   * DELETE /api/events/:id/publish
   * Unpublishes an event. Requires organizer access.
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/events/:id/publish",
    {
      preHandler: [createVerifyToken({ requireOrganizer: true })],
    },
    async (request, reply) => {
      // Validate params
      const parseResult = EventIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      const event = await eventService.unpublishEvent(parseResult.data.id);
      const response = toEventResponse(event);

      // Broadcast SSE event:updated (non-blocking)
      const ssePayload: EventUpdatedPayload = {
        event: {
          id: event.id,
          title: event.title,
          meetingTime: event.meetingTime?.toISOString() ?? null,
          publishedAt: null,
          publishedVenueId: null,
        },
      };
      fastify.sse
        .broadcast({
          eventId: event.id,
          type: "event:updated",
          payload: ssePayload,
        })
        .catch(() => {
          /* SSE broadcast failure is non-critical */
        });

      return reply.send(response);
    }
  );
}
