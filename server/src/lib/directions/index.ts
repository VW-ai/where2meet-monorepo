/**
 * Google Directions API service.
 *
 * Provides route calculation between geographic points with:
 * - Support for driving, walking, transit, and bicycling modes
 * - Redis caching with 1-hour TTL
 * - Exponential backoff retry for transient failures
 * - Imperial distance/duration formatting
 *
 * @module lib/directions
 *
 * @example
 * ```typescript
 * import { calculateRoute, calculateBatchRoutes } from "./lib/directions/index.js";
 *
 * // Single route
 * const route = await calculateRoute(
 *   { lat: 40.7128, lng: -74.006 },
 *   { lat: 40.758, lng: -73.9855 },
 *   "driving",
 *   "participant-uuid"
 * );
 *
 * // Batch routes
 * const routes = await calculateBatchRoutes(
 *   [{ id: "p1", lat: 40.7128, lng: -74.006 }],
 *   { lat: 40.758, lng: -73.9855 },
 *   "walking"
 * );
 * ```
 */

// Types
export type {
  GeoPoint,
  TravelMode,
  FormattedValue,
  RouteResult,
  DirectionsResult,
} from "./types.js";

// Errors
export { RouteNotFoundError, DirectionsApiError } from "./errors.js";

// Formatting utilities
export { formatDistanceImperial, formatDuration } from "./format.js";

// Route calculation operations
export {
  calculateRoute,
  calculateBatchRoutes,
  type ParticipantLocation,
} from "./routes.js";
