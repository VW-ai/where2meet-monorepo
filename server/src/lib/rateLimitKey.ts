import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

export const PROXY_SECRET_HEADER = "x-w2m-proxy-secret";
export const CLIENT_IP_HEADER = "x-w2m-client-ip";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * The address a request is rate limited under.
 *
 * The Next.js server calls the API from Vercel's shared IPs on behalf of many
 * visitors. When it proves itself with the shared secret, the visitor IP it
 * forwards is the key; otherwise the key is the caller's own IP.
 */
export function rateLimitKey(
  request: Pick<FastifyRequest, "ip" | "headers">,
  proxySecret: string | undefined
): string {
  const secret = request.headers[PROXY_SECRET_HEADER];
  const clientIp = request.headers[CLIENT_IP_HEADER];
  if (
    proxySecret &&
    typeof secret === "string" &&
    typeof clientIp === "string" &&
    isIP(clientIp) !== 0 &&
    timingSafeEqual(digest(secret), digest(proxySecret))
  ) {
    return clientIp;
  }
  return request.ip;
}
