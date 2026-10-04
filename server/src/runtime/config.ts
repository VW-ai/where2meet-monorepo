import { z } from "zod";

const schema = z.object({
  databaseUrl: z.string().min(1),
  redisUrl: z.url(),
  environment: z.enum(["development", "production", "test"]),
  host: z.string().min(1),
  port: z.coerce.number().int().min(0).max(65535),
  corsOrigins: z.array(z.string().min(1)).min(1),
  logLevel: z.enum(["silent", "error", "warn", "info", "debug"]),
  rateLimitMax: z.coerce.number().int().positive(),
  rateLimitWindowMs: z.coerce.number().int().positive(),
  redisTimeoutMs: z.coerce.number().int().min(100),
  heartbeatIntervalMs: z.coerce.number().int().min(100),
  streamTimeoutMs: z.coerce.number().int().min(1000),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = schema.parse({
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    environment: process.env.NODE_ENV ?? "development",
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ?? 3000,
    corsOrigins: (process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
    rateLimitMax: process.env.RATE_LIMIT_MAX ?? 100,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS ?? 900000,
    redisTimeoutMs: process.env.REDIS_TIMEOUT_MS ?? 1500,
    heartbeatIntervalMs: process.env.SSE_HEARTBEAT_INTERVAL_MS ?? 30000,
    streamTimeoutMs: process.env.SSE_CONNECTION_TIMEOUT_MS ?? 3600000,
    ...overrides,
  });
  if (config.environment === "production" && config.corsOrigins.includes("*")) {
    throw new Error("Production requires explicit CORS origins");
  }
  return config;
}
