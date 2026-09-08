import "dotenv/config";
import { startServer } from "./server.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { disconnectRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

// Handle graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await Promise.all([disconnectPrisma(), disconnectRedis()]);
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err: unknown) {
    logger.error(err, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection");
  process.exit(1);
});

// Start the server
startServer().catch((err: unknown) => {
  // Write raw error to stderr so it's visible regardless of log format
  process.stderr.write(
    `STARTUP FAILED: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`
  );
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});
