/**
 * Authentication utilities module.
 *
 * Provides helper functions for authentication:
 * - Token extraction from HTTP headers
 * - ID validation helpers
 * @module utils/auth
 */

import { ValidationError, UnauthorizedError } from "../types/errors.js";
import { EventIdSchema } from "../schemas/event.js";
import { ParticipantIdSchema } from "../schemas/participant.js";

/**
 * Extracts Bearer token from Authorization header.
 * @param authHeader - Authorization header value
 * @returns Token string or null if invalid format
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
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
 * Extracts Bearer token from Authorization header.
 * Throws if token is missing or malformed.
 * @param authHeader - Authorization header value
 * @returns Token string
 * @throws UnauthorizedError if token is missing or invalid
 */
export function requireBearerToken(authHeader: string | undefined): string {
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  return token;
}

/**
 * Validates event ID format.
 * @param eventId - Event ID to validate
 * @throws ValidationError if format is invalid
 */
export function validateEventId(eventId: string | undefined): asserts eventId is string {
  if (!eventId) {
    throw new ValidationError("Event ID is required");
  }

  const parseResult = EventIdSchema.safeParse({ id: eventId });
  if (!parseResult.success) {
    throw new ValidationError("Invalid event ID format");
  }
}

/**
 * Validates participant ID format.
 * @param participantId - Participant ID to validate
 * @throws ValidationError if format is invalid
 */
export function validateParticipantId(
  participantId: string | undefined
): asserts participantId is string {
  if (!participantId) {
    throw new ValidationError("Participant ID is required");
  }

  const parseResult = ParticipantIdSchema.safeParse({ participantId });
  if (!parseResult.success) {
    throw new ValidationError("Invalid participant ID format");
  }
}
