/**
 * Fastify server setup module.
 *
 * Creates and configures the Fastify server with:
 * - CORS (enabled for all origins in dev)
 * - Pino logging (pretty in dev, JSON in prod)
 * - Rate limiting
 * - Error handling
 * - Database connection (Prisma)
 * - Health check routes
 * - Event routes
 * @module server
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config, isTest } from "./lib/config.js";
import { errorHandler } from "./utils/errorHandler.js";
import dbPlugin from "./plugins/db.js";
import { healthRoutes } from "./routes/health.js";
import { eventRoutes } from "./routes/events.js";
import { participantRoutes } from "./routes/participants.js";
import { venueRoutes } from "./routes/venues.js";
import { voteRoutes } from "./routes/votes.js";

/**
 * Creates and configures a Fastify server instance.
 *
 * Configuration includes:
 * - Structured logging with Pino (disabled in tests)
 * - Rate limiting based on environment configuration
 * - Global error handler for consistent error responses
 * - Health check endpoints
 * @returns Configured Fastify server instance (not yet listening)
 * @example
 * ```typescript
 * const server = await buildServer();
 *
 * // For testing
 * const response = await server.inject({ method: "GET", url: "/health" });
 *
 * // For production
 * await server.listen({ port: 3000 });
 * ```
 */
export async function buildServer() {
  const server = Fastify({
    logger: isTest
      ? false
      : {
          level: config.NODE_ENV === "production" ? "info" : "debug",
          redact: {
            paths: ["req.headers.authorization", "res.headers.authorization"],
            censor: "[REDACTED]",
          },
          transport:
            config.NODE_ENV === "development"
              ? {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                  },
                }
              : undefined,
        },
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    disableRequestLogging: isTest,
  });

  // Register CORS (allow all origins in dev, configure for prod)
  await server.register(cors, {
    origin: config.NODE_ENV === "production" ? false : true,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // Register rate limiting (disabled in test environment)
  if (!isTest) {
    await server.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW_MS,
      errorResponseBuilder: () => ({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
        },
      }),
    });
  }

  // Set error handler
  server.setErrorHandler(errorHandler);

  // Register database plugin
  await server.register(dbPlugin);

  // Register routes
  await server.register(healthRoutes);
  await server.register(eventRoutes);
  await server.register(participantRoutes);
  await server.register(venueRoutes);
  await server.register(voteRoutes);

  return server;
}

/**
 * Builds and starts the server.
 *
 * Listens on the configured HOST and PORT from environment variables.
 * Logs startup information on success.
 * @returns Running Fastify server instance
 * @throws Error if server fails to start (e.g., port in use)
 * @example
 * ```typescript
 * // In index.ts
 * startServer().catch((err) => {
 *   console.error("Failed to start:", err);
 *   process.exit(1);
 * });
 * ```
 */
export async function startServer() {
  const server = await buildServer();

  try {
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });

    server.log.info(
      `Server running at http://${config.HOST}:${String(config.PORT)} in ${config.NODE_ENV} mode`
    );

    return server;
  } catch (err) {
    server.log.error(err, "Failed to start server");
    throw err;
  }
}
