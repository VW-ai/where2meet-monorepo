/**
 * Redis client module.
 *
 * Provides a singleton Redis client with automatic reconnection
 * and exponential backoff for resilient caching operations.
 * @module lib/redis
 */

import { Redis } from "ioredis";

// Singleton pattern for Redis client
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

/**
 * Creates a new Redis client with reconnection configuration.
 * @returns Configured Redis client instance
 */
function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 50, 30000);
      return delay;
    },
    reconnectOnError(err: Error) {
      // Reconnect on specific errors
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("error", (err: Error) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected successfully");
  });

  client.on("reconnecting", () => {
    console.log("[Redis] Reconnecting...");
  });

  return client;
}

/**
 * Singleton Redis client instance.
 *
 * Automatically handles reconnection with exponential backoff.
 * @example
 * ```typescript
 * import { redis } from "./lib/redis.js";
 *
 * await redis.set("key", "value", "EX", 3600);
 * const value = await redis.get("key");
 * ```
 */
export const redis: Redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Gracefully disconnects from Redis.
 *
 * Sends QUIT command and waits for pending operations to complete.
 * @returns Promise that resolves when disconnected
 * @example
 * ```typescript
 * process.on("SIGTERM", async () => {
 *   await disconnectRedis();
 *   process.exit(0);
 * });
 * ```
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

/**
 * Checks if the Redis connection is healthy.
 *
 * Sends a PING command and expects PONG response.
 * @returns True if connected and responsive, false otherwise
 * @example
 * ```typescript
 * const isHealthy = await checkRedisHealth();
 * if (!isHealthy) {
 *   console.error("Redis connection failed");
 * }
 * ```
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Increments and returns the next SSE sequence number for an event.
 *
 * Uses Redis INCR for atomic, monotonic increment.
 * Sequence starts at 1 (INCR creates key at 1 if not exists).
 * No TTL - sequence persists for event lifetime.
 * @param eventId - Event ID
 * @returns Next sequence number (starts from 1)
 * @example
 * ```typescript
 * const seq = await getNextSSESequence("evt_123");
 * console.log(seq); // 1, 2, 3, ...
 * ```
 */
export async function getNextSSESequence(eventId: string): Promise<number> {
  const key = `sse:seq:${eventId}`;
  return await redis.incr(key);
}

/**
 * Gets the current SSE sequence number for an event without incrementing.
 *
 * Used for snapshot endpoints to include current seq in response.
 * @param eventId - Event ID
 * @returns Current sequence number, or 0 if not initialized
 * @example
 * ```typescript
 * const currentSeq = await getCurrentSSESequence("evt_123");
 * console.log(currentSeq); // 0 if no events, otherwise current seq
 * ```
 */
export async function getCurrentSSESequence(eventId: string): Promise<number> {
  const key = `sse:seq:${eventId}`;
  const seq = await redis.get(key);
  return seq ? parseInt(seq, 10) : 0;
}

/**
 * Resets the SSE sequence counter for an event.
 *
 * Used for testing or event cleanup.
 * After reset, next getNextSSESequence() will return 1.
 * @param eventId - Event ID
 * @example
 * ```typescript
 * await resetSSESequence("evt_123");
 * const seq = await getNextSSESequence("evt_123");
 * console.log(seq); // 1 (reset to start)
 * ```
 */
export async function resetSSESequence(eventId: string): Promise<void> {
  const key = `sse:seq:${eventId}`;
  await redis.del(key);
}
