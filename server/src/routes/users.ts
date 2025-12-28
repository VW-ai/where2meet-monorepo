/**
 * User routes module.
 *
 * Provides API endpoints for user profile and event management.
 * All endpoints require session authentication.
 * @module routes/users
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createUserService } from "../services/user.js";
import { createUserEventService } from "../services/userEvent.js";
import { createRequireSession } from "../hooks/sessionAuth.js";
import {
  UpdateUserSchema,
  ClaimEventSchema,
  type UpdateUserInput,
  type ClaimEventInput,
} from "../schemas/user.js";
import {
  toUserResponse,
  toUserEventResponse,
  toClaimEventResponse,
} from "../mappers/user.mapper.js";
import type { UserResponse, UserEventsListResponse, ClaimEventResponse } from "../dto/index.js";

/**
 * Registers user routes on the Fastify instance.
 *
 * Endpoints:
 * - GET /api/users/me - Get current user's profile
 * - PATCH /api/users/me - Update current user's profile
 * - GET /api/users/me/events - List current user's events
 * - POST /api/users/me/events/claim - Claim an event with participant token
 */
export function userRoutes(fastify: FastifyInstance): void {
  const userService = createUserService(fastify.db);
  const userEventService = createUserEventService(fastify.db);
  const requireSession = createRequireSession();

  /**
   * GET /api/users/me
   * Returns the current user's profile.
   */
  fastify.get(
    "/api/users/me",
    {
      preHandler: [requireSession],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.userAuth) {
        throw new Error("Session required");
      }
      const { userId } = request.userAuth;

      const user = await userService.getProfile(userId);

      const response: UserResponse = toUserResponse(user);

      return reply.send(response);
    }
  );

  /**
   * PATCH /api/users/me
   * Updates the current user's profile.
   */
  fastify.patch<{ Body: UpdateUserInput }>(
    "/api/users/me",
    {
      preHandler: [requireSession],
    },
    async (request, reply) => {
      // Validate request body
      const parseResult = UpdateUserSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      if (!request.userAuth) {
        throw new Error("Session required");
      }
      const { userId } = request.userAuth;

      const user = await userService.updateProfile(userId, parseResult.data);

      const response: UserResponse = toUserResponse(user);

      return reply.send(response);
    }
  );

  /**
   * GET /api/users/me/events
   * Lists all events linked to the current user.
   */
  fastify.get(
    "/api/users/me/events",
    {
      preHandler: [requireSession],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.userAuth) {
        throw new Error("Session required");
      }
      const { userId } = request.userAuth;

      const userEvents = await userEventService.listEvents(userId);

      const response: UserEventsListResponse = {
        events: userEvents.map(toUserEventResponse),
      };

      return reply.send(response);
    }
  );

  /**
   * POST /api/users/me/events/claim
   * Claims an event using a participant token.
   * Links the user's account to their anonymous participant.
   */
  fastify.post<{ Body: ClaimEventInput }>(
    "/api/users/me/events/claim",
    {
      preHandler: [requireSession],
    },
    async (request, reply) => {
      // Validate request body
      const parseResult = ClaimEventSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      if (!request.userAuth) {
        throw new Error("Session required");
      }
      const { userId } = request.userAuth;
      const { eventId, participantToken } = parseResult.data;

      const userEvent = await userEventService.claimEvent({
        userId,
        eventId,
        participantToken,
      });

      const response: ClaimEventResponse = toClaimEventResponse(userEvent);

      return reply.status(201).send(response);
    }
  );
}
