import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

describe("client IP behind Railway's edge", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
    server.get("/test/ip", (request) => ({ ip: request.ip }));
  });

  afterAll(async () => {
    await server.close();
  });

  async function ipFor(remoteAddress: string, forwardedFor?: string) {
    const response = await server.inject({
      method: "GET",
      url: "/test/ip",
      remoteAddress,
      headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    });
    return response.json<{ ip: string }>().ip;
  }

  it("resolves the same client whichever edge and internal hop carried it", async () => {
    expect(await ipFor("100.64.0.2", "203.0.113.7, 152.233.47.66")).toBe("203.0.113.7");
    expect(await ipFor("100.64.0.9", "203.0.113.7, 152.233.47.68")).toBe("203.0.113.7");
  });

  it("tells two clients apart", async () => {
    expect(await ipFor("100.64.0.2", "198.51.100.4, 152.233.47.66")).toBe("198.51.100.4");
  });

  it("ignores client-supplied hops left of the address the edge saw", async () => {
    expect(await ipFor("100.64.0.2", "1.2.3.4, 203.0.113.7, 152.233.47.66")).toBe("203.0.113.7");
  });

  it("falls back to the peer for internal calls without forwarding headers", async () => {
    expect(await ipFor("100.64.0.2")).toBe("100.64.0.2");
  });
});
