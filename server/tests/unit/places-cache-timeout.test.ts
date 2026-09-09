import { afterEach, describe, expect, it, vi } from "vitest";
import net from "node:net";

// A live TCP connection that never answers commands reproduces a stalled cache.
describe("Optional Places cache command deadline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("bounds commands when the optional cache stops responding", async () => {
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
          // PING and GET intentionally receive no response after ready.
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    const previousURL = process.env.REDIS_URL;
    process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { placesRedis: redis } = await import("../../src/lib/places/redis.js");
    try {
      await redis.connect();
      const start = performance.now();
      await expect(redis.get("search-test")).rejects.toThrow("Command timed out");
      expect(performance.now() - start).toBeGreaterThanOrEqual(900);
      expect(performance.now() - start).toBeLessThan(2000);
    } finally {
      redis.disconnect();
      if (previousURL === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousURL;
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
