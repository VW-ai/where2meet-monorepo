import { Redis } from "ioredis";
import type { ProviderCache } from "../cache.js";

export function createProviderCache(url: string): ProviderCache & { close(): void } {
  const connection = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 500,
    commandTimeout: 500,
    retryStrategy: (attempt) => Math.min(attempt * 250, 3000),
  });
  connection.on("error", () => undefined);
  void connection.connect().catch(() => undefined);

  async function bounded<T>(
    signal: AbortSignal,
    fallback: T,
    operation: () => Promise<T>
  ): Promise<T> {
    if (connection.status !== "ready" || signal.aborted) return fallback;
    return new Promise<T>((resolve) => {
      const complete = (value: T) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        resolve(value);
      };
      const abort = () => {
        complete(fallback);
      };
      const timer = setTimeout(abort, 500);
      signal.addEventListener("abort", abort, { once: true });
      void operation().then(complete, abort);
    });
  }

  return {
    read: (key, signal) => bounded(signal, null, () => connection.get(key)),
    async write(key, value, ttlSeconds, signal) {
      await bounded(signal, undefined, async () => {
        await connection.set(key, value, "EX", ttlSeconds);
      });
    },
    close: () => {
      connection.disconnect();
    },
  };
}
