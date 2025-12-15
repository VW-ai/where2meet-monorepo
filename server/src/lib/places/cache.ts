/**
 * Redis caching for Google Places API results.
 * @module lib/places/cache
 */

import { config } from "../config.js";
import { redis } from "../redis.js";
import type { PlaceResult, PlaceDetails, GeoPoint } from "./types.js";

/** Cache key prefixes */
const PLACES_SEARCH_CACHE_PREFIX = "places:search:";
const PLACES_DETAILS_CACHE_PREFIX = "places:details:";

/**
 * Normalizes lat/lng to 4 decimal places for cache key consistency.
 * 4 decimals = ~11m precision, good for venue search.
 */
function normalizeCoord(coord: number): string {
  return coord.toFixed(4);
}

/**
 * Generates cache key for nearby/text search.
 */
export function getSearchCacheKey(
  center: GeoPoint,
  radiusMeters: number,
  type: string | null,
  query: string | null
): string {
  const lat = normalizeCoord(center.lat);
  const lng = normalizeCoord(center.lng);
  const typeKey = type ?? "any";
  const queryKey = query ? query.toLowerCase().trim().replace(/\s+/g, "_") : "none";
  return `${PLACES_SEARCH_CACHE_PREFIX}${lat},${lng}:${String(radiusMeters)}:${typeKey}:${queryKey}`;
}

/**
 * Generates cache key for place details.
 */
export function getDetailsCacheKey(placeId: string): string {
  return `${PLACES_DETAILS_CACHE_PREFIX}${placeId}`;
}

/**
 * Retrieves cached search results from Redis.
 */
export async function getCachedSearch(cacheKey: string): Promise<PlaceResult[] | null> {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PlaceResult[];
    }
  } catch (error) {
    console.warn("[Places] Cache read error:", error);
  }
  return null;
}

/**
 * Stores search results in Redis cache.
 */
export async function cacheSearchResults(cacheKey: string, results: PlaceResult[]): Promise<void> {
  try {
    await redis.set(
      cacheKey,
      JSON.stringify(results),
      "EX",
      config.PLACES_SEARCH_CACHE_TTL_SECONDS
    );
  } catch (error) {
    console.warn("[Places] Cache write error:", error);
  }
}

/**
 * Retrieves cached place details from Redis.
 */
export async function getCachedDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const cached = await redis.get(getDetailsCacheKey(placeId));
    if (cached) {
      return JSON.parse(cached) as PlaceDetails;
    }
  } catch (error) {
    console.warn("[Places] Cache read error:", error);
  }
  return null;
}

/**
 * Stores place details in Redis cache.
 */
export async function cacheDetails(placeId: string, details: PlaceDetails): Promise<void> {
  try {
    await redis.set(
      getDetailsCacheKey(placeId),
      JSON.stringify(details),
      "EX",
      config.PLACES_DETAILS_CACHE_TTL_SECONDS
    );
  } catch (error) {
    console.warn("[Places] Cache write error:", error);
  }
}
