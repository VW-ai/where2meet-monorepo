/**
 * Directions mapper module.
 *
 * Transforms route calculation results to Response DTOs with runtime validation.
 * @module mappers/directions
 */

import type { ModeRouteResult, TravelMode } from "../lib/directions/index.js";
import { DirectionsResponseSchema, type DirectionsResponse } from "../dto/directions.dto.js";

/**
 * Transforms route results to DirectionsResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 * @param venueId - Google Place ID of the destination venue
 * @param travelMode - Override sent with the request, or null for per-person modes
 * @param routes - Array of route results from directions library
 * @returns Validated DirectionsResponse DTO
 */
export function toDirectionsResponse(
  venueId: string,
  travelMode: TravelMode | null,
  routes: ModeRouteResult[]
): DirectionsResponse {
  const response = {
    venueId,
    travelMode,
    routes: routes.map((route) => ({
      participantId: route.participantId,
      distance: route.distance ? { value: route.distance.value, text: route.distance.text } : null,
      duration: route.duration ? { value: route.duration.value, text: route.duration.text } : null,
      polyline: route.polyline,
      travelMode: route.travelMode,
    })),
  };

  return DirectionsResponseSchema.parse(response);
}
