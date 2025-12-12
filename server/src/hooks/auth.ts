/**
 * Authentication hooks module.
 *
 * Provides preHandler hooks for verifying organizer tokens.
 * @module hooks/auth
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../types/errors.js";
import { createEventService } from "../services/event.js";
import { EventIdSchema } from "../schemas/event.js";

/**
 * Extracts Bearer token from Authorization header.
 * @param authHeader - Authorization header value
 * @returns Token string or null if invalid format
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * PreHandler hook that verifies the organizer token.
 * Expects Authorization header with format: "Bearer {token}" and route param `:id`.
 * @throws UnauthorizedError (401) if token is missing or malformed
 * @throws ForbiddenError (403) if token doesn't match event's organizerToken
 * @throws EventNotFoundError (404) if event doesn't exist
 * @example
 * ```typescript
 * fastify.patch("/api/events/:id", {
 *   preHandler: [verifyOrganizerToken],
 *   handler: updateEventHandler,
 * });
 * ```
 */
export async function verifyOrganizerToken(
  request: FastifyRequest<{ Params: { id: string } }>,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const eventId = request.params.id;

  if (!eventId) {
    throw new UnauthorizedError("Event ID is required");
  }

  // Validate UUID format before hitting the database
  const parseResult = EventIdSchema.safeParse({ id: eventId });
  if (!parseResult.success) {
    throw new ValidationError("Invalid event ID format");
  }

  const eventService = createEventService(request.server.db);
  const isValid = await eventService.verifyOrganizerToken(eventId, token);

  if (!isValid) {
    throw new ForbiddenError("Invalid organizer token");
  }
}
