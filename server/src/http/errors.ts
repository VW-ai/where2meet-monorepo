import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError, type ErrorCode } from "../errors.js";

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  EVENT_NOT_FOUND: 404,
  PARTICIPANT_NOT_FOUND: 404,
  EVENT_ALREADY_PUBLISHED: 409,
  ADDRESS_NOT_FOUND: 400,
  EXTERNAL_SERVICE_ERROR: 502,
  FEATURE_NOT_AVAILABLE: 501,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export function registerErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      error instanceof Error && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    if (error instanceof AppError)
      return reply
        .code(statusByCode[error.code])
        .send({ error: { code: error.code, message: error.message } });
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION_ERROR", message: "Invalid request" } });
    if (statusCode === 429)
      return reply.code(429).send({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
        },
      });
    if (statusCode === 400 || statusCode === 413 || statusCode === 415)
      return reply
        .code(statusCode)
        .send({ error: { code: "VALIDATION_ERROR", message: "Invalid request" } });
    request.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Request failed"
    );
    return reply
      .code(500)
      .send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } })
  );
}
