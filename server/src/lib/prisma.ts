/**
 * Prisma database client module.
 *
 * Provides a singleton PrismaClient instance to prevent connection
 * exhaustion during development with hot reloading.
 * @module lib/prisma
 */

import { PrismaClient } from "../generated/prisma/index.js";

// Singleton pattern for Prisma client
// Prevents multiple instances in development with hot reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance.
 *
 * In development, logs queries, errors, and warnings.
 * In production, only logs errors.
 * @example
 * ```typescript
 * import { prisma } from "./lib/prisma.js";
 *
 * const events = await prisma.event.findMany();
 * ```
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnects from the database.
 *
 * Should be called during application shutdown to ensure
 * all connections are properly closed.
 * @returns Promise that resolves when disconnected
 * @example
 * ```typescript
 * process.on("SIGTERM", async () => {
 *   await disconnectPrisma();
 *   process.exit(0);
 * });
 * ```
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Checks if the database connection is healthy.
 *
 * Executes a simple query to verify the connection is working.
 * @returns True if connected and responsive, false otherwise
 * @example
 * ```typescript
 * const isHealthy = await checkDatabaseHealth();
 * if (!isHealthy) {
 *   console.error("Database connection failed");
 * }
 * ```
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
