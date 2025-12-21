/**
 * Global error handler module.
 *
 * Provides centralized error handling for all Fastify routes,
 * converting errors to standardized API responses.
 * @module utils/errorHandler
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, createErrorResponse } from "../types/errors.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("errorHandler");

/**
 * Global error handler for Fastify.
 *
 * Handles different error types and returns standardized error responses:
 * - AppError: Custom application errors with status codes
 * - ZodError: Schema validation errors (400)
 * - FastifyError with validation: Request validation errors (400)
 * - Rate limit errors (429)
 * - Unknown errors: Logged but sanitized for client (500)
 *
 * All errors are logged with request context for debugging.
 * @param error - The error thrown during request handling
 * @param request - Fastify request object (for logging context)
 * @param reply - Fastify reply object (to send error response)
 * @returns Reply with appropriate error response
 * @example
 * ```typescript
 * // Register in server setup
 * server.setErrorHandler(errorHandler);
 *
 * // Then throw errors in routes
 * throw new NotFoundError("User");
 * // Client receives: { error: { code: "NOT_FOUND", message: "User not found" } }
 * ```
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error with request context
  // Use 'err' key for Pino's built-in error serializer
  const logContext = {
    requestId: request.id,
    method: request.method,
    url: request.url,
    err: error,
  };

  // Handle AppError (our custom errors)
  if (error instanceof AppError) {
    if (error.isOperational) {
      logger.warn(logContext, "Operational error");
    } else {
      logger.error(logContext, "Non-operational error");
    }

    return reply.status(error.statusCode).send(createErrorResponse(error));
  }

  // Handle Zod validation errors (v4 uses 'issues' property)
  if (error instanceof ZodError) {
    const zodError = error as ZodError;
    const firstIssue = zodError.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Validation error";

    logger.warn({ ...logContext, zodIssues: zodError.issues }, "Validation error");

    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    });
  }

  // Handle Fastify validation errors
  if (error.validation) {
    logger.warn(logContext, "Fastify validation error");
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
      },
    });
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    logger.warn(logContext, "Rate limit exceeded");
    return reply.status(429).send({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    });
  }

  // Handle unknown errors (don't expose details to client)
  logger.error(logContext, "Unexpected error");

  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
