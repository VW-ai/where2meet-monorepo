/**
 * Redis cache for AMap geocodes and city codes.
 *
 * Searches, details and routes reuse the places and directions caches with an
 * "amap:" key prefix; this covers the lookups those modules have no cache for.
 * Cache errors never fail a request.
 * @module lib/amap/cache
 */

import { redis } from "../redis.js";
import { describeError } from "../log-redaction.js";

const AMAP_CACHE_PREFIX = "amap:";

/**
 * Reads a cached JSON value.
 * @param key - Key without the "amap:" prefix
 * @returns The value, or null on a miss or cache error
 */
export async function readAmapCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(`${AMAP_CACHE_PREFIX}${key}`);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (error) {
    console.warn("[AMap] Cache read error:", describeError(error));
    return null;
  }
}

/**
 * Stores a JSON value.
 * @param key - Key without the "amap:" prefix
 * @param value - Value to store
 * @param ttlSeconds - Expiry
 */
export async function writeAmapCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.set(`${AMAP_CACHE_PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn("[AMap] Cache write error:", describeError(error));
  }
}
