/**
 * Google Maps Geocoding service module.
 *
 * Provides address geocoding with Redis caching and retry logic.
 * Uses the Google Geocoding API for address-to-coordinate conversion.
 * @module lib/maps
 */

import { config } from "./config.js";
import { redis } from "./redis.js";

/** Cache key prefix for geocoding results */
const GEOCODE_CACHE_PREFIX = "geocode:";

/**
 * Result of a successful geocode operation.
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Error thrown when an address cannot be found or geocoded.
 */
export class AddressNotFoundError extends Error {
  constructor(address: string) {
    super(`Address not found: ${address}`);
    this.name = "AddressNotFoundError";
  }
}

/**
 * Error thrown when the Google API returns an error.
 */
export class GeocodingApiError extends Error {
  constructor(
    message: string,
    public readonly status: string
  ) {
    super(message);
    this.name = "GeocodingApiError";
  }
}

/**
 * Google Geocoding API response structure.
 */
interface GoogleGeocodeApiResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeApiResult[];
  error_message?: string;
}

/**
 * Generates a cache key for an address.
 *
 * Normalizes the address by lowercasing and trimming whitespace.
 * @param address - The address to generate a key for
 * @returns Cache key string
 */
function getCacheKey(address: string): string {
  const normalized = address.toLowerCase().trim().replace(/\s+/g, " ");
  return `${GEOCODE_CACHE_PREFIX}${normalized}`;
}

/**
 * Delays execution for a specified duration.
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches geocode data from Google API with timeout.
 * @param address - Address to geocode
 * @returns Google API response
 * @throws Error on timeout or network failure
 */
async function fetchFromGoogleApi(address: string): Promise<GoogleGeocodeResponse> {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${config.GOOGLE_MAPS_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new GeocodingApiError(
        `HTTP error: ${String(response.status)} ${response.statusText}`,
        "HTTP_ERROR"
      );
    }

    return (await response.json()) as GoogleGeocodeResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses Google API response into GeocodeResult.
 * @param response - Google API response
 * @param address - Original address (for error messages)
 * @returns Parsed geocode result
 * @throws AddressNotFoundError if no results
 * @throws GeocodingApiError on API errors
 */
function parseGeocodeResponse(response: GoogleGeocodeResponse, address: string): GeocodeResult {
  switch (response.status) {
    case "OK": {
      const result = response.results[0];
      if (!result) {
        throw new AddressNotFoundError(address);
      }
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }
    case "ZERO_RESULTS":
      throw new AddressNotFoundError(address);
    case "OVER_QUERY_LIMIT":
      throw new GeocodingApiError("API quota exceeded", response.status);
    case "REQUEST_DENIED":
      throw new GeocodingApiError(response.error_message ?? "Request denied", response.status);
    case "INVALID_REQUEST":
      throw new GeocodingApiError(response.error_message ?? "Invalid request", response.status);
    default:
      throw new GeocodingApiError(
        response.error_message ?? `Unknown error: ${response.status}`,
        response.status
      );
  }
}

/**
 * Retrieves cached geocode result from Redis.
 * @param address - Address to look up
 * @returns Cached result or null if not found
 */
async function getCachedGeocode(address: string): Promise<GeocodeResult | null> {
  try {
    const cached = await redis.get(getCacheKey(address));
    if (cached) {
      return JSON.parse(cached) as GeocodeResult;
    }
  } catch (error) {
    // Log but don't fail on cache errors
    console.warn("[Maps] Cache read error:", error);
  }
  return null;
}

/**
 * Stores geocode result in Redis cache.
 * @param address - Address key
 * @param result - Geocode result to cache
 */
async function cacheGeocode(address: string, result: GeocodeResult): Promise<void> {
  try {
    await redis.set(
      getCacheKey(address),
      JSON.stringify(result),
      "EX",
      config.GEOCODE_CACHE_TTL_SECONDS
    );
  } catch (error) {
    // Log but don't fail on cache errors
    console.warn("[Maps] Cache write error:", error);
  }
}

/**
 * Determines if an error is retryable.
 *
 * Retries on network errors, timeouts, and rate limits.
 * Does not retry on address not found or invalid requests.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AddressNotFoundError) {
    return false;
  }
  if (error instanceof GeocodingApiError) {
    // Retry on rate limits, don't retry on denied/invalid
    return error.status === "OVER_QUERY_LIMIT";
  }
  // Retry on network errors, timeouts
  return true;
}

/**
 * Geocodes an address to coordinates with caching and retry.
 *
 * Checks Redis cache first, then calls Google Geocoding API.
 * Uses exponential backoff for retries (100ms, 400ms, 1600ms).
 * @param address - Street address to geocode
 * @returns Geocode result with lat, lng, and formatted address
 * @throws AddressNotFoundError if address cannot be found
 * @throws GeocodingApiError on API errors
 * @example
 * ```typescript
 * const result = await geocode("1600 Amphitheatre Parkway, Mountain View, CA");
 * console.log(result.lat, result.lng);
 * // 37.4224764, -122.0842499
 * ```
 */
export async function geocode(address: string): Promise<GeocodeResult> {
  // Check cache first
  const cached = await getCachedGeocode(address);
  if (cached) {
    return cached;
  }

  // Retry configuration: 100ms, 400ms, 1600ms (exponential backoff)
  const maxRetries = 3;
  const baseDelay = 100;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFromGoogleApi(address);
      const result = parseGeocodeResponse(response, address);

      // Cache successful result
      await cacheGeocode(address, result);

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't delay after last attempt
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(4, attempt);
        console.warn(
          `[Maps] Geocode attempt ${String(attempt + 1)} failed, retrying in ${String(delayMs)}ms:`,
          error instanceof Error ? error.message : error
        );
        await delay(delayMs);
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Checks if the Maps service is configured and ready.
 *
 * Verifies that the Google API key is set.
 * @returns True if API key is configured
 */
export function isMapsConfigured(): boolean {
  return config.GOOGLE_MAPS_API_KEY.length > 0;
}
