/**
 * Event routes module.
 *
 * Provides API endpoints for event CRUD operations.
 * Uses mappers to transform entities to Response DTOs.
 * @module routes/events
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createEventService } from "../services/event.js";
import {
  CreateEventSchema,
  UpdateEventSchema,
  EventIdSchema,
  type CreateEventInput,
  type UpdateEventInput,
  type EventIdParam,
} from "../schemas/event.js";
import { toEventResponse, toCreateEventResponse, toGetMECResponse } from "../mappers/event.mapper.js";
import { createDeleteSuccessResponse } from "../dto/index.js";
import { verifyOrganizerToken } from "../hooks/auth.js";
import { ValidationError } from "../types/errors.js";

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
 */
export function eventRoutes(fastify: FastifyInstance): void {
  const eventService = createEventService(fastify.db);

  /**
   * POST /api/events
   * Creates a new event and returns it with the organizerToken.
   */
  fastify.post(
    "/api/events",
    async (request: CreateEventRequest, reply: FastifyReply) => {
      // Validate request body
      const parseResult = CreateEventSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { event, organizerToken, organizerParticipantId } = await eventService.createEvent(parseResult.data);
      const response = toCreateEventResponse(event, organizerToken, organizerParticipantId);

      return reply.status(201).send(response);
    }
  );

  /**
   * GET /api/events/:id
   * Returns event details without organizerToken.
   */
  fastify.get(
    "/api/events/:id",
    async (request: GetEventRequest, reply: FastifyReply) => {
      // Validate params
      const parseResult = EventIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      const event = await eventService.getEvent(parseResult.data.id);
      const response = toEventResponse(event);

      return reply.send(response);
    }
  );

  /**
   * GET /api/events/:id/mec
   * Returns the Minimum Enclosing Circle for the event's participants.
   * Returns null center/radius if no participants have valid locations.
   */
  fastify.get(
    "/api/events/:id/mec",
    async (request: GetEventRequest, reply: FastifyReply) => {
      // Validate params
      const parseResult = EventIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new ValidationError("Invalid event ID format");
      }

      const mecResult = await eventService.getMEC(parseResult.data.id);
      const response = toGetMECResponse(mecResult);

      return reply.send(response);
    }
  );

  /**
   * PATCH /api/events/:id
   * Updates event fields. Requires organizerToken.
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateEventInput }>(
    "/api/events/:id",
    {
      preHandler: [verifyOrganizerToken()],
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

      const event = await eventService.updateEvent(
        paramsResult.data.id,
        bodyResult.data
      );
      const response = toEventResponse(event);

      return reply.send(response);
    }
  );

  /**
   * DELETE /api/events/:id
   * Deletes an event. Requires organizerToken.
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/events/:id",
    {
      preHandler: [verifyOrganizerToken()],
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
}
