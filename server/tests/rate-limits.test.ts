import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance, InjectOptions } from "fastify";
import { buildServer } from "../src/server.js";

// Requests carry invalid bodies on purpose: the limiter counts them before
// validation runs, so no test reaches the database or a paid map API.

const servers: FastifyInstance[] = [];

async function limitedServer() {
  const server = await buildServer({ rateLimits: true });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function statuses(server: FastifyInstance, request: InjectOptions, times: number) {
  const codes: number[] = [];
  for (let i = 0; i < times; i++) {
    codes.push((await server.inject(request)).statusCode);
  }
  return codes;
}

function firstLimited(codes: number[]) {
  return codes.indexOf(429) + 1;
}

const search: InjectOptions = { method: "POST", url: "/api/venues/search", payload: {} };
const reverseGeocode: InjectOptions = { method: "GET", url: "/api/amap/reverse-geocode" };
const photo: InjectOptions = { method: "GET", url: "/api/places/photo" };
const login: InjectOptions = { method: "POST", url: "/api/auth/login", payload: {} };
const register: InjectOptions = { method: "POST", url: "/api/auth/register", payload: {} };
const createEvent: InjectOptions = { method: "POST", url: "/api/events", payload: {} };

describe("per-route rate limits", () => {
  it("limits a map route after 60 requests", async () => {
    const server = await limitedServer();
    expect(firstLimited(await statuses(server, search, 61))).toBe(61);
  });

  it("counts each map route in its own bucket", async () => {
    const server = await limitedServer();
    await statuses(server, search, 61);
    expect(await statuses(server, reverseGeocode, 3)).not.toContain(429);
  });

  it("limits venue photos like other map routes", async () => {
    const server = await limitedServer();
    expect(firstLimited(await statuses(server, photo, 61))).toBe(61);
  });

  it("limits login and register after 10 requests each", async () => {
    const server = await limitedServer();
    expect(firstLimited(await statuses(server, login, 11))).toBe(11);
    expect(firstLimited(await statuses(server, register, 11))).toBe(11);
  });

  it("limits event creation after 30 requests", async () => {
    const server = await limitedServer();
    expect(firstLimited(await statuses(server, createEvent, 31))).toBe(31);
  });

  it("never limits routes outside those classes", async () => {
    const server = await limitedServer();
    const health = await statuses(server, { method: "GET", url: "/health" }, 150);
    const session = await statuses(server, { method: "GET", url: "/api/auth/session" }, 150);
    expect([...health, ...session]).not.toContain(429);
  });

  it("gives each client behind Railway's edge its own bucket", async () => {
    const server = await limitedServer();
    const viaEdge = (client: string): InjectOptions => ({
      ...login,
      remoteAddress: "100.64.0.2",
      headers: { "x-forwarded-for": `${client}, 152.233.47.66` },
    });
    expect(firstLimited(await statuses(server, viaEdge("203.0.113.7"), 11))).toBe(11);
    expect(await statuses(server, viaEdge("198.51.100.4"), 3)).not.toContain(429);
  });
});
