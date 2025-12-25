/**
 * Environment configuration module.
 *
 * Validates and provides typed access to environment variables
 * using Zod schemas. Fails fast on startup if configuration is invalid.
 * @module lib/config
 */

import { z } from "zod";

/**
 * Helper to transform string environment variables to numbers with defaults.
 * @param defaultValue - Default numeric value if env var is not set
 * @returns Zod schema that transforms string to number
 */
const stringToNumber = (defaultValue: number) =>
  z
    .string()
    .default(String(defaultValue))
    .transform(Number)
    .pipe(z.number());

/**
 * Environment configuration schema.
 *
 * Defines all expected environment variables with validation rules.
 */
const envSchema = z.object({
  // Server
  PORT: stringToNumber(3000).pipe(z.number().min(1).max(65535)),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Rate Limiting
  RATE_LIMIT_MAX: stringToNumber(100).pipe(z.number().min(1)),
  RATE_LIMIT_WINDOW_MS: stringToNumber(900000).pipe(z.number().min(1000)),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  GEOCODE_CACHE_TTL_SECONDS: stringToNumber(2592000).pipe(z.number().min(0)), // 30 days
  GEOCODE_TIMEOUT_MS: stringToNumber(5000).pipe(z.number().min(100).max(30000)),

  // Google Places
  PLACES_SEARCH_CACHE_TTL_SECONDS: stringToNumber(3600).pipe(z.number().min(0)), // 1 hour
  PLACES_DETAILS_CACHE_TTL_SECONDS: stringToNumber(86400).pipe(z.number().min(0)), // 24 hours
  PLACES_TIMEOUT_MS: stringToNumber(5000).pipe(z.number().min(100).max(30000)),

  // Google Directions
  DIRECTIONS_CACHE_TTL_SECONDS: stringToNumber(3600).pipe(z.number().min(0)), // 1 hour
  DIRECTIONS_TIMEOUT_MS: stringToNumber(10000).pipe(z.number().min(100).max(30000)), // 10 seconds
});

/**
 * Parsed and validated environment configuration type.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates environment variables.
 * @returns Validated configuration object
 * @throws Error if any required env var is missing or invalid
 */
function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(JSON.stringify(result.error.issues, null, 2));
    throw new Error("Invalid environment configuration");
  }

  return result.data;
}

/**
 * Validated environment configuration.
 *
 * Access typed environment variables through this object.
 * @example
 * ```typescript
 * import { config } from "./lib/config.js";
 *
 * console.log(`Server running on port ${config.PORT}`);
 * ```
 */
export const config = loadConfig();

/** True when NODE_ENV is "development" */
export const isDevelopment = config.NODE_ENV === "development";

/** True when NODE_ENV is "production" */
export const isProduction = config.NODE_ENV === "production";

/** True when NODE_ENV is "test" */
export const isTest = config.NODE_ENV === "test";
