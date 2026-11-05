/**
 * Directions DTO interfaces and schemas.
 * @module dto/directions
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * Travel modes supported by Google Directions API.
 */
export const TravelModeSchema = z.enum(["driving", "walking", "transit", "bicycling"]);
export type TravelMode = z.infer<typeof TravelModeSchema>;

/**
 * Formatted value with raw number and display text.
 * Used for distance (meters → "3.2 mi") and duration (seconds → "12 mins").
 */
export const FormattedValueSchema = z.object({
  /** Raw value in meters (distance) or seconds (duration) */
  value: z.number(),
  /** Human-readable formatted text */
  text: z.string(),
});

export type FormattedValue = z.infer<typeof FormattedValueSchema>;

/**
 * Single participant route result.
 */
export const RouteResponseSchema = z.object({
  /** Participant UUID */
  participantId: z.uuid(),
  /** Distance in meters with formatted imperial text. Null if participant has no location. */
  distance: FormattedValueSchema.nullable(),
  /** Duration in seconds with formatted text. Null if participant has no location. */
  duration: FormattedValueSchema.nullable(),
  /** Encoded polyline for Google Maps rendering. Null if participant has no location. */
  polyline: z.string().nullable(),
  /** Mode this route was calculated for. Present even when the participant has no location. */
  travelMode: TravelModeSchema,
});

export type RouteResponse = z.infer<typeof RouteResponseSchema>;

/**
 * Directions response containing routes for all participants to a venue.
 */
export const DirectionsResponseSchema = z.object({
  /** Google Place ID of the destination venue */
  venueId: z.string(),
  /** The override sent with the request. Null when each route used its participant's own mode. */
  travelMode: TravelModeSchema.nullable(),
  /** Routes for each participant */
  routes: z.array(RouteResponseSchema),
});

export type DirectionsResponse = z.infer<typeof DirectionsResponseSchema>;

/**
 * One way to get from a place to the venue, for someone not yet on the list.
 */
export const PreviewRouteResponseSchema = z.object({
  travelMode: TravelModeSchema,
  distance: FormattedValueSchema,
  duration: FormattedValueSchema,
  polyline: z.string(),
});

export type PreviewRouteResponse = z.infer<typeof PreviewRouteResponseSchema>;

/**
 * Where an address is, and how it reaches the venue. A mode with no route is absent.
 */
export const ParticipantPreviewResponseSchema = z.object({
  location: LocationResponseSchema,
  formattedAddress: z.string(),
  routes: z.array(PreviewRouteResponseSchema),
});

export type ParticipantPreviewResponse = z.infer<typeof ParticipantPreviewResponseSchema>;
