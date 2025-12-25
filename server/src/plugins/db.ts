/**
 * Database plugin module.
 *
 * Decorates Fastify instance with Prisma client for dependency injection.
 * Handles graceful shutdown on server close.
 * @module plugins/db
 */

import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { prisma, disconnectPrisma } from "../lib/prisma.js";
import type { PrismaClient } from "@prisma/client";

/**
 * Extends Fastify instance type to include db property.
 */
declare module "fastify" {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

/**
 * Fastify plugin that decorates the instance with Prisma client.
 *
 * Usage in routes: `request.server.db.event.findMany()`
 *
 * The plugin also registers an onClose hook to gracefully disconnect
 * from the database when the server shuts down.
 */
function dbPlugin(fastify: FastifyInstance): void {
  // Decorate fastify instance with prisma client
  fastify.decorate("db", prisma);

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await disconnectPrisma();
  });
}

export default fp(dbPlugin, {
  name: "db",
});
