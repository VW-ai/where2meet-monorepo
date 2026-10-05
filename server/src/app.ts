import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { loadConfig, type AppConfig } from "./runtime/config.js";
import { createDatabase, databaseReady } from "./runtime/database.js";
import { createNotifications } from "./runtime/notifications.js";
import { createMeetings } from "./modules/meetings/store.js";
import { createAccounts } from "./modules/accounts/store.js";
import { createPlaces } from "./modules/places/store.js";
import { registerRoutes } from "./http/routes.js";
import { registerErrors } from "./http/errors.js";
import { encodeNotice, registerSSE } from "./http/sse.js";

export async function makeApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "req.body.password",
          "req.body.passwordHash",
          "req.body.participantToken",
          "token",
          "tokenHash",
          "credential",
        ],
        censor: "[REDACTED]",
      },
      serializers: {
        req: (request: FastifyRequest) => ({
          method: request.method,
          url: request.url.replace(/\?.*$/s, ""),
        }),
        err: (error: unknown) => ({
          type: error instanceof Error ? error.name : "UnknownError",
          message: "[REDACTED]",
          stack: "[REDACTED]",
        }),
      },
    },
    disableRequestLogging: config.environment === "test",
  });
  const database = createDatabase(config.databaseUrl);
  const notifications = await createNotifications({
    url: config.redisUrl,
    timeoutMs: config.redisTimeoutMs,
    reportFailure: () => {
      app.log.warn("Redis notification connection unavailable");
    },
  });
  app.addHook("onClose", async () => {
    notifications.close();
    await database.$disconnect();
  });
  registerErrors(app);
  await app.register(cors, {
    origin: (origin, callback) => {
      callback(
        null,
        !origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)
      );
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  if (config.environment === "production")
    await app.register(rateLimit, {
      max: config.rateLimitMax,
      timeWindow: config.rateLimitWindowMs,
    });
  const meetings = createMeetings({
    database,
    places: createPlaces(database, {
      apiKey: config.googleMapsApiKey,
      timeoutMs: config.geocodeTimeoutMs,
      endpoint: config.geocodeEndpoint,
    }),
    publish: (eventId, notice) => notifications.publish(eventId, encodeNotice(eventId, notice)),
    publicationFailed: (eventId) => {
      app.log.warn({ eventId }, "Committed meeting update could not be broadcast");
    },
  });
  registerRoutes(app, meetings, createAccounts(database), config.environment === "production");
  registerSSE(app, meetings, notifications, config);
  app.get("/health", () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    const [dbHealthy, redisHealthy] = await Promise.all([
      databaseReady(database),
      notifications.ready(),
    ]);
    return reply.code(dbHealthy ? 200 : 503).send({
      status: dbHealthy ? (redisHealthy ? "ok" : "degraded") : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "ok" : "unhealthy",
        redis: redisHealthy ? "ok" : "unhealthy",
      },
    });
  });
  return app;
}
