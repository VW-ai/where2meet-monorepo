import { afterEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import type { Redis } from "ioredis";

// The shared client backs the geocode/directions caches and the SSE sequence
// counter. When Redis is unhealthy those calls must fail fast so requests like
// adding a participant fall back instead of waiting through reconnect retries.

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

async function loadClient(url: string): Promise<Redis> {
  process.env.REDIS_URL = url;
  globalForRedis.redis = undefined;
  vi.resetModules();
  const { redis } = await import("../../src/lib/redis.js");
  return redis;
}

async function timeRejection(operation: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await expect(operation()).rejects.toThrow();
  return performance.now() - start;
}

describe("Shared Redis client command deadline", () => {
  const previousURL = process.env.REDIS_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    globalForRedis.redis = undefined;
    if (previousURL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousURL;
  });

  it("bounds commands when Redis accepts connections but stops answering", async () => {
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        // Parse just enough RESP to answer the normal connection handshake.
        while (buffer.startsWith("*")) {
          const headerEnd = buffer.indexOf("\r\n");
          if (headerEnd < 0) return;
          const count = Number(buffer.slice(1, headerEnd));
          let offset = headerEnd + 2;
          const args: string[] = [];
          for (let i = 0; i < count; i++) {
            const lengthEnd = buffer.indexOf("\r\n", offset);
            if (lengthEnd < 0) return;
            const length = Number(buffer.slice(offset + 1, lengthEnd));
            const valueStart = lengthEnd + 2;
            if (buffer.length < valueStart + length + 2) return;
            args.push(buffer.slice(valueStart, valueStart + length));
            offset = valueStart + length + 2;
          }
          buffer = buffer.slice(offset);
          if (args[0]?.toLowerCase() === "client") socket.write("+OK\r\n");
          if (args[0]?.toLowerCase() === "info") socket.write("$11\r\nloading:0\r\n\r\n");
          // GET and INCR intentionally receive no response after ready.
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const redis = await loadClient(`redis://127.0.0.1:${port}`);
    try {
      await new Promise<void>((resolve) => redis.once("ready", () => resolve()));
      const elapsed = await timeRejection(() => redis.get("geocode:test"));
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThan(1500);
    } finally {
      redis.disconnect();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("bounds commands queued while Redis refuses connections", async () => {
    // Reserve a port, then close it so connections are refused.
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const redis = await loadClient(`redis://127.0.0.1:${port}`);
    try {
      const elapsed = await timeRejection(() => redis.incr("sse:seq:test"));
      expect(elapsed).toBeLessThan(1500);
    } finally {
      redis.disconnect();
    }
  });
});
