/**
 * Google Places search operations.
 * @module lib/places/search
 */

import { config } from "../config.js";
import { PlaceNotFoundError, handleApiStatus } from "./errors.js";
import {
  getSearchCacheKey,
  getCachedSearch,
  cacheSearchResults,
  getCachedDetails,
  cacheDetails,
} from "./cache.js";
import {
  fetchPlacesApi,
  withRetry,
  parseGooglePlace,
  parseGooglePlaceDetails,
} from "./client.js";
import type {
  GeoPoint,
  PlaceResult,
  PlaceDetails,
  GooglePlacesSearchResponse,
  GooglePlaceDetailsResponse,
} from "./types.js";

/**
 * Searches for places nearby a location.
 *
 * Uses Google Places Nearby Search API with caching.
 * @param center - Geographic center point for search
 * @param radiusMeters - Search radius in meters (max 50000)
 * @param options - Optional filters
 * @param options.type - Google Place type filter (e.g., "cafe", "restaurant")
 * @param options.keyword - Keyword to filter results
 * @returns Array of place results sorted by prominence
 * @throws PlacesApiError on API errors
 */
export async function searchNearbyPlaces(
  center: GeoPoint,
  radiusMeters: number,
  options: { type?: string; keyword?: string } = {}
): Promise<PlaceResult[]> {
  const cacheKey = getSearchCacheKey(center, radiusMeters, options.type ?? null, options.keyword ?? null);

  // Check cache first
  const cached = await getCachedSearch(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await withRetry(async () => {
    const params = new URLSearchParams({
      location: `${String(center.lat)},${String(center.lng)}`,
      radius: String(radiusMeters),
      key: config.GOOGLE_MAPS_API_KEY,
    });

    if (options.type) {
      params.set("type", options.type);
    }
    if (options.keyword) {
      params.set("keyword", options.keyword);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
    const response = await fetchPlacesApi<GooglePlacesSearchResponse>(url);

    handleApiStatus(response.status, response.error_message);

    return response.results.map(parseGooglePlace);
  });

  // Cache results
  await cacheSearchResults(cacheKey, results);

  return results;
}

/**
 * Searches for places using a text query.
 *
 * Uses Google Places Text Search API with location bias.
 * @param query - Search query (e.g., "coffee shops", "Starbucks")
 * @param center - Geographic center for location bias
 * @param radiusMeters - Search radius in meters
 * @returns Array of place results
 * @throws PlacesApiError on API errors
 */
export async function textSearchPlaces(
  query: string,
  center: GeoPoint,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const cacheKey = getSearchCacheKey(center, radiusMeters, null, query);

  // Check cache first
  const cached = await getCachedSearch(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await withRetry(async () => {
    const params = new URLSearchParams({
      query,
      location: `${String(center.lat)},${String(center.lng)}`,
      radius: String(radiusMeters),
      key: config.GOOGLE_MAPS_API_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
    const response = await fetchPlacesApi<GooglePlacesSearchResponse>(url);

    handleApiStatus(response.status, response.error_message);

    return response.results.map(parseGooglePlace);
  });

  // Cache results
  await cacheSearchResults(cacheKey, results);

  return results;
}

/**
 * Gets detailed information about a place.
 *
 * Uses Google Places Details API with caching.
 * @param placeId - Google Place ID
 * @returns Detailed place information
 * @throws PlaceNotFoundError if place doesn't exist
 * @throws PlacesApiError on API errors
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  // Check cache first
  const cached = await getCachedDetails(placeId);
  if (cached) {
    return cached;
  }

  const details = await withRetry(async () => {
    const fields = [
      "place_id",
      "name",
      "vicinity",
      "formatted_address",
      "geometry",
      "types",
      "rating",
      "user_ratings_total",
      "price_level",
      "opening_hours",
      "photos",
      "formatted_phone_number",
      "website",
    ].join(",");

    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: config.GOOGLE_MAPS_API_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    const response = await fetchPlacesApi<GooglePlaceDetailsResponse>(url);

    handleApiStatus(response.status, response.error_message);

    if (!response.result) {
      throw new PlaceNotFoundError(placeId);
    }

    return parseGooglePlaceDetails(response.result);
  });

  // Cache details
  await cacheDetails(placeId, details);

  return details;
}

/**
 * Builds a Google Places photo URL.
 * @param photoReference - Photo reference from Places API
 * @param maxWidth - Maximum width in pixels (default 400)
 * @returns Photo URL
 */
export function buildPhotoUrl(photoReference: string, maxWidth = 400): string {
  const params = new URLSearchParams({
    photoreference: photoReference,
    maxwidth: String(maxWidth),
    key: config.GOOGLE_MAPS_API_KEY,
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}

/**
 * Checks if the Places service is configured and ready.
 * @returns True if API key is configured
 */
export function isPlacesConfigured(): boolean {
  return config.GOOGLE_MAPS_API_KEY.length > 0;
}
