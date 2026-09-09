/**
 * Error classes for Google Places API.
 * @module lib/places/errors
 */

/**
 * Error thrown when a place cannot be found.
 */
export class PlaceNotFoundError extends Error {
  constructor(placeId: string) {
    super(`Place not found: ${placeId}`);
    this.name = "PlaceNotFoundError";
  }
}

/**
 * Error thrown when the Google Places API returns an error.
 */
export class PlacesApiError extends Error {
  constructor(
    message: string,
    public readonly status: string
  ) {
    super(message);
    this.name = "PlacesApiError";
  }
}

/**
 * Handles Google API response status and throws appropriate errors.
 * @param status - Google API status string
 * @param errorMessage - Optional error message from response
 * @throws PlacesApiError for non-OK/ZERO_RESULTS statuses
 */
export function handleApiStatus(status: string, errorMessage?: string): void {
  switch (status) {
    case "OK":
    case "ZERO_RESULTS":
      return;
    case "OVER_QUERY_LIMIT":
      throw new PlacesApiError("API quota exceeded", status);
    case "REQUEST_DENIED":
      throw new PlacesApiError(errorMessage ?? "Request denied", status);
    case "INVALID_REQUEST":
      throw new PlacesApiError(errorMessage ?? "Invalid request", status);
    case "NOT_FOUND":
      throw new PlacesApiError(errorMessage ?? "Place not found", status);
    default:
      throw new PlacesApiError(errorMessage ?? `Unknown error: ${status}`, status);
  }
}
