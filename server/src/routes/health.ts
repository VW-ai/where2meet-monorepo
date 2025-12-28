/**
 * Health check routes module.
 *
 * Provides endpoints for monitoring server and service health.
 * @module routes/health
 */

import type { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../lib/prisma.js";
import { checkRedisHealth } from "../lib/redis.js";

/**
 * Response format for detailed health check endpoint.
 */
interface HealthResponse {
  /** Overall system status */
  status: "ok" | "degraded" | "unhealthy";
  /** ISO 8601 timestamp of the health check */
  timestamp: string;
  /** Individual service status */
  services: {
    database: "ok" | "unhealthy";
    redis: "ok" | "unhealthy";
  };
}

/**
 * Registers health check routes on the Fastify instance.
 *
 * Endpoints:
 * - `GET /health` - Simple liveness check (always 200 if server running)
 * - `GET /health/ready` - Detailed readiness check (checks DB and Redis)
 * @param fastify - Fastify instance to register routes on
 * @example
 * ```typescript
 * // In server.ts
 * await server.register(healthRoutes);
 *
 * // Usage
 * // curl http://localhost:3000/health
 * // { "status": "ok" }
 *
 * // curl http://localhost:3000/health/ready
 * // { "status": "ok", "timestamp": "...", "services": { ... } }
 * ```
 */
export function healthRoutes(fastify: FastifyInstance) {
  /**
   * Basic liveness check.
   * Returns 200 if the server is running, regardless of service health.
   */
  fastify.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok" });
  });

  /**
   * Detailed readiness check.
   * Checks database connectivity (required) and Redis connectivity (optional).
   *
   * Status codes:
   * - 200: Database healthy (Redis may be unhealthy)
   * - 503: Database unhealthy
   */
  fastify.get("/health/ready", async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    const response: HealthResponse = {
      status: dbHealth ? (redisHealth ? "ok" : "degraded") : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? "ok" : "unhealthy",
        redis: redisHealth ? "ok" : "unhealthy",
      },
    };

    const statusCode = dbHealth ? 200 : 503;

    return reply.status(statusCode).send(response);
  });
}
