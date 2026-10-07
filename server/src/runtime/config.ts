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
  googleMapsApiKey: z.string(),
  geocodeTimeoutMs: z.coerce.number().int().min(100).max(30000),
  geocodeEndpoint: z.url(),
  publicApiOrigin: z.string().nullable(),
  deploymentId: z.uuid().nullable(),
  placesEndpoint: z.url(),
  directionsEndpoint: z.url(),
  placesTimeoutMs: z.coerce.number().int().min(100).max(30000),
  searchTimeoutMs: z.coerce.number().int().min(100).max(30000),
  routeTimeoutMs: z.coerce.number().int().min(100).max(30000),
  photoTimeoutMs: z.coerce.number().int().min(100).max(30000),
  searchTtlSeconds: z.coerce.number().int().positive(),
  detailsTtlSeconds: z.coerce.number().int().positive(),
  routeTtlSeconds: z.coerce.number().int().positive(),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (
    overrides.publicApiOrigin === undefined &&
    !process.env.PUBLIC_API_ORIGIN &&
    railwayDomain &&
    !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(
      railwayDomain
    )
  )
    throw new Error("RAILWAY_PUBLIC_DOMAIN must be a public hostname");
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
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    geocodeTimeoutMs: process.env.GEOCODE_TIMEOUT_MS ?? 5000,
    geocodeEndpoint: "https://maps.googleapis.com/maps/api/geocode/json",
    publicApiOrigin:
      process.env.PUBLIC_API_ORIGIN ??
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null),
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
    placesEndpoint: "https://maps.googleapis.com/maps/api/place/",
    directionsEndpoint: "https://maps.googleapis.com/maps/api/directions/json",
    placesTimeoutMs: process.env.PLACES_TIMEOUT_MS ?? 5000,
    searchTimeoutMs: process.env.SEARCH_TIMEOUT_MS ?? 10000,
    routeTimeoutMs: process.env.ROUTE_TIMEOUT_MS ?? 10000,
    photoTimeoutMs: process.env.PHOTO_TIMEOUT_MS ?? 10000,
    searchTtlSeconds: process.env.PLACES_SEARCH_TTL_SECONDS ?? 3600,
    detailsTtlSeconds: process.env.PLACES_DETAILS_TTL_SECONDS ?? 86400,
    routeTtlSeconds: process.env.ROUTE_TTL_SECONDS ?? 3600,
    ...overrides,
  });
  if (config.environment === "production" && config.corsOrigins.includes("*")) {
    throw new Error("Production requires explicit CORS origins");
  }
  if (config.publicApiOrigin !== null) {
    const origin = new URL(config.publicApiOrigin);
    const local =
      config.environment !== "production" &&
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (
      (origin.protocol !== "https:" && !local) ||
      ["0.0.0.0", "[::]"].includes(origin.hostname) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      origin.port === "0"
    )
      throw new Error(
        "PUBLIC_API_ORIGIN must be a public HTTPS origin or a local development origin"
      );
    config.publicApiOrigin = origin.origin;
  } else if (config.environment === "production") {
    throw new Error("Production requires PUBLIC_API_ORIGIN or RAILWAY_PUBLIC_DOMAIN");
  }
  return config;
}
