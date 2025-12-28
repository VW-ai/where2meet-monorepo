/**
 * Cookie plugin module.
 *
 * Registers @fastify/cookie for parsing and setting cookies.
 * Used for session-based authentication.
 * @module plugins/cookie
 */

import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cookie from "@fastify/cookie";

/**
 * Fastify plugin that registers cookie support.
 *
 * Enables:
 * - `request.cookies` - Object containing parsed cookies
 * - `reply.setCookie(name, value, options)` - Set a cookie
 * - `reply.clearCookie(name, options)` - Clear a cookie
 */
async function cookiePlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cookie);
}

export default fp(cookiePlugin, {
  name: "cookie",
});
