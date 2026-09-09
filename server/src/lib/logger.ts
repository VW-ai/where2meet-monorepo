/**
 * Pino logger module.
 *
 * Provides structured JSON logging with pretty printing in development.
 * @module lib/logger
 */

import pino from "pino";
import { config } from "./config.js";

/**
 * Root Pino logger instance.
 *
 * - In development: debug level with pretty printing
 * - In production: info level with JSON output
 * @example
 * ```typescript
 * import { logger } from "./lib/logger.js";
 *
 * logger.info("Server started");
 * logger.error({ err }, "Database connection failed");
 * ```
 */
export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
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
  base: {
    env: config.NODE_ENV,
  },
});

/**
 * Creates a child logger with a module name context.
 *
 * Use this to add context to logs from specific modules.
 * @param name - Module or component name for context
 * @returns Child logger instance with module name attached
 * @example
 * ```typescript
 * const log = createLogger("EventService");
 * log.info({ eventId }, "Event created");
 * // Output: { module: "EventService", eventId: "abc", msg: "Event created" }
 * ```
 */
export function createLogger(name: string) {
  return logger.child({ module: name });
}
