/**
 * Optional Places cache connection. Required event/SSE sequence operations keep
 * using the shared Redis client and its existing delivery semantics.
 */
import { Redis } from "ioredis";

export const placesRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 1000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy(times: number) {
    return Math.min(times * 250, 10000);
  },
});

// The cache helpers already report misses. Handle connection errors without
// logging credentials or adding repeated connection stack traces to searches.
placesRedis.on("error", () => {
  /* The optional cache falls back to Google Places. */
});
