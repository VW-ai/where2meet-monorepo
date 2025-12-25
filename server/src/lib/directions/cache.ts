/**
 * Redis caching for Google Directions API route results.
 * Caches individual routes by origin/destination coordinates.
 * @module lib/directions/cache
 */

import { config } from "../config.js";
import { redis } from "../redis.js";
import type { TravelMode } from "./types.js";

/** Cache key prefix for direction routes */
const DIRECTIONS_CACHE_PREFIX = "directions:";

/**
 * Cached route data (without participantId, which varies per request).
 */
export interface CachedRouteData {
  distanceValue: number;
  distanceText: string;
  durationValue: number;
  durationText: string;
  polyline: string;
}

/**
 * Normalizes lat/lng to 4 decimal places for cache key consistency.
 * 4 decimals = ~11m precision - ensures stable cache hits despite
 * minor float differences.
 */
function normalizeCoord(coord: number): string {
  return coord.toFixed(4);
}

/**
 * Generates cache key for a single route.
 * Format: directions:{originLat},{originLng}:{destLat},{destLng}:{mode}
 * @param originLat - Origin latitude
 * @param originLng - Origin longitude
 * @param destLat - Destination latitude
 * @param destLng - Destination longitude
 * @param mode - Travel mode (driving, walking, transit, bicycling)
 * @returns Cache key string
 */
export function getRouteCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode
): string {
  const origin = `${normalizeCoord(originLat)},${normalizeCoord(originLng)}`;
  const dest = `${normalizeCoord(destLat)},${normalizeCoord(destLng)}`;
  return `${DIRECTIONS_CACHE_PREFIX}${origin}:${dest}:${mode}`;
}

/**
 * Retrieves cached route from Redis.
 * Cache errors are logged but never thrown - cache misses are graceful.
 * @param cacheKey - The cache key to look up
 * @returns Cached route data or null if not found
 */
export async function getCachedRoute(cacheKey: string): Promise<CachedRouteData | null> {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CachedRouteData;
    }
  } catch (error) {
    console.warn("[Directions] Cache read error:", error);
  }
  return null;
}

/**
 * Stores route result in Redis cache.
 * Cache errors are logged but never thrown - cache write failures
 * don't break the request.
 * @param cacheKey - The cache key to store under
 * @param data - Route data to cache
 */
export async function cacheRoute(cacheKey: string, data: CachedRouteData): Promise<void> {
  try {
    await redis.set(
      cacheKey,
      JSON.stringify(data),
      "EX",
      config.DIRECTIONS_CACHE_TTL_SECONDS
    );
  } catch (error) {
    console.warn("[Directions] Cache write error:", error);
  }
}
