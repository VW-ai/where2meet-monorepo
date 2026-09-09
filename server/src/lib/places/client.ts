/**
 * Google Places API HTTP client with retry logic.
 * @module lib/places/client
 */

import { config } from "../config.js";
import { PlacesApiError, PlaceNotFoundError } from "./errors.js";
import type { GooglePlaceResult, PlaceResult, PlaceDetails } from "./types.js";

/**
 * Delays execution for a specified duration.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof PlaceNotFoundError) {
    return false;
  }
  if (error instanceof PlacesApiError) {
    return error.status === "OVER_QUERY_LIMIT";
  }
  return true;
}

/**
 * Fetches from Google Places API with timeout.
 */
export async function fetchPlacesApi<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.PLACES_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new PlacesApiError(
        `HTTP error: ${String(response.status)} ${response.statusText}`,
        "HTTP_ERROR"
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes API call with exponential backoff retry.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 100;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(4, attempt);
        console.warn(
          `[Places] Attempt ${String(attempt + 1)} failed, retrying in ${String(delayMs)}ms:`,
          error instanceof Error ? error.message : error
        );
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Parses Google Place result into normalized PlaceResult.
 */
export function parseGooglePlace(place: GooglePlaceResult): PlaceResult {
  return {
    placeId: place.place_id,
    name: place.name,
    address: place.vicinity ?? place.formatted_address ?? "",
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    types: place.types ?? [],
    rating: place.rating ?? null,
    userRatingsTotal: place.user_ratings_total ?? null,
    priceLevel: place.price_level ?? null,
    openNow: place.opening_hours?.open_now ?? null,
    photoReference: place.photos?.[0]?.photo_reference ?? null,
  };
}

/**
 * Parses Google Place result into detailed PlaceDetails.
 */
export function parseGooglePlaceDetails(place: GooglePlaceResult): PlaceDetails {
  return {
    ...parseGooglePlace(place),
    formattedPhoneNumber: place.formatted_phone_number ?? null,
    website: place.website ?? null,
    openingHours: place.opening_hours?.weekday_text ?? null,
  };
}
