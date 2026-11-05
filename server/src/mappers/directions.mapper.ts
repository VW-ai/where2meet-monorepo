/**
 * Directions mapper module.
 *
 * Transforms route calculation results to Response DTOs with runtime validation.
 * @module mappers/directions
 */

import type { ModeRouteResult, TravelMode } from "../lib/directions/index.js";
import type { ParticipantPreview } from "../services/directions.js";
import {
  DirectionsResponseSchema,
  ParticipantPreviewResponseSchema,
  type DirectionsResponse,
  type ParticipantPreviewResponse,
} from "../dto/directions.dto.js";

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

/**
 * Transforms a participant preview to its Response DTO. A result the provider returned
 * empty is a mode with no route, so it is left out.
 * @param preview - Geocoded place and its routes
 * @returns Validated ParticipantPreviewResponse DTO
 */
export function toParticipantPreviewResponse(
  preview: ParticipantPreview
): ParticipantPreviewResponse {
  return ParticipantPreviewResponseSchema.parse({
    location: preview.location,
    formattedAddress: preview.formattedAddress,
    routes: preview.routes.flatMap(({ travelMode, distance, duration, polyline }) =>
      distance && duration && polyline ? [{ travelMode, distance, duration, polyline }] : []
    ),
  });
}
