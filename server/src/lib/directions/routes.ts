/**
 * Google Directions route calculation operations.
 * @module lib/directions/routes
 */

import { config } from "../config.js";
import { handleApiStatus, RouteNotFoundError } from "./errors.js";
import { getRouteCacheKey, getCachedRoute, cacheRoute, type CachedRouteData } from "./cache.js";
import { fetchDirectionsApi, withRetry } from "./client.js";
import { formatDistanceImperial, formatDuration } from "./format.js";
import type { GeoPoint, TravelMode, RouteResult } from "./types.js";

const GOOGLE_DIRECTIONS_API_URL = "https://maps.googleapis.com/maps/api/directions/json";

/**
 * Calculates a route between two points.
 * @param origin - Starting point coordinates
 * @param destination - Ending point coordinates
 * @param mode - Travel mode (driving, walking, transit, bicycling)
 * @param participantId - Participant ID for result association
 * @returns Route result with distance, duration, and polyline
 * @throws DirectionsApiError on API errors
 * @throws RouteNotFoundError if no route exists
 */
export async function calculateRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode,
  participantId: string
): Promise<RouteResult> {
  const cacheKey = getRouteCacheKey(origin.lat, origin.lng, destination.lat, destination.lng, mode);

  // Check cache first
  const cached = await getCachedRoute(cacheKey);
  if (cached) {
    return buildRouteResult(cached, participantId);
  }

  // Fetch from Google Directions API with retry
  const routeData = await withRetry(async () => {
    const params = new URLSearchParams({
      origin: `${String(origin.lat)},${String(origin.lng)}`,
      destination: `${String(destination.lat)},${String(destination.lng)}`,
      mode,
      key: config.GOOGLE_MAPS_API_KEY,
    });

    const url = `${GOOGLE_DIRECTIONS_API_URL}?${params.toString()}`;
    const response = await fetchDirectionsApi(url);

    // Handle API status codes
    handleApiStatus(response.status, response.error_message);

    // Check for valid route
    const route = response.routes[0];
    const leg = route?.legs[0];
    if (!route || !leg) {
      throw new RouteNotFoundError(
        `${String(origin.lat)},${String(origin.lng)}`,
        `${String(destination.lat)},${String(destination.lng)}`
      );
    }

    // Create cached data (without participantId since that varies per request)
    const data: CachedRouteData = {
      distanceValue: leg.distance.value,
      distanceText: formatDistanceImperial(leg.distance.value),
      durationValue: leg.duration.value,
      durationText: formatDuration(leg.duration.value),
      polyline: route.overview_polyline.points,
    };

    return data;
  });

  // Cache the result
  await cacheRoute(cacheKey, routeData);

  return buildRouteResult(routeData, participantId);
}

/**
 * Builds a RouteResult from cached data and participant ID.
 */
function buildRouteResult(data: CachedRouteData, participantId: string): RouteResult {
  return {
    participantId,
    distance: {
      value: data.distanceValue,
      text: data.distanceText,
    },
    duration: {
      value: data.durationValue,
      text: data.durationText,
    },
    polyline: data.polyline,
  };
}

/**
 * Participant data for batch route calculation.
 */
export interface ParticipantLocation {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Calculates routes for multiple participants to a single venue.
 * Runs all calculations in parallel for performance.
 * @param participants - Array of participant locations
 * @param venue - Venue coordinates (destination)
 * @param mode - Travel mode
 * @returns Array of route results (failed routes are logged and excluded)
 */
export async function calculateBatchRoutes(
  participants: ParticipantLocation[],
  venue: GeoPoint,
  mode: TravelMode
): Promise<RouteResult[]> {
  // Run all route calculations in parallel
  const results = await Promise.allSettled(
    participants.map((p) => calculateRoute({ lat: p.lat, lng: p.lng }, venue, mode, p.id))
  );

  // Filter successful results, log failures
  const routes: RouteResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const participant = participants[i];
    if (!result || !participant) continue;

    if (result.status === "fulfilled") {
      routes.push(result.value);
    } else {
      console.warn(
        `[Directions] Failed to calculate route for participant ${participant.id}:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      );
    }
  }

  return routes;
}
