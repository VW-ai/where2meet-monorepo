/**
 * Error classes for Google Directions API.
 * @module lib/directions/errors
 */

/**
 * Thrown when no route can be found between origin and destination.
 */
export class RouteNotFoundError extends Error {
  constructor(origin: string, destination: string) {
    super(`No route found from ${origin} to ${destination}`);
    this.name = "RouteNotFoundError";
  }
}

/**
 * Thrown when Google Directions API returns an error status.
 */
export class DirectionsApiError extends Error {
  constructor(
    message: string,
    public readonly status: string
  ) {
    super(message);
    this.name = "DirectionsApiError";
  }
}

/**
 * Handles Google Directions API status codes and throws appropriate errors.
 *
 * @param status - The status string from Google Directions API response
 * @param errorMessage - Optional error message from the API
 * @throws DirectionsApiError for non-OK statuses
 */
export function handleApiStatus(status: string, errorMessage?: string): void {
  switch (status) {
    case "OK":
      return;
    case "ZERO_RESULTS":
    case "NOT_FOUND":
      throw new DirectionsApiError(
        errorMessage ?? "No route found between origin and destination",
        status
      );
    case "OVER_QUERY_LIMIT":
      throw new DirectionsApiError("API quota exceeded - please try again later", status);
    case "REQUEST_DENIED":
      throw new DirectionsApiError(
        errorMessage ?? "Request denied - check API key configuration",
        status
      );
    case "INVALID_REQUEST":
      throw new DirectionsApiError(
        errorMessage ?? "Invalid request - check origin/destination format",
        status
      );
    case "MAX_WAYPOINTS_EXCEEDED":
      throw new DirectionsApiError("Too many waypoints in request", status);
    case "MAX_ROUTE_LENGTH_EXCEEDED":
      throw new DirectionsApiError("Route is too long to calculate", status);
    default:
      throw new DirectionsApiError(
        errorMessage ?? `Unknown Directions API error: ${status}`,
        status
      );
  }
}
