/**
 * Directions DTO interfaces and schemas.
 * @module dto/directions
 */

import { z } from "zod";

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
});

export type RouteResponse = z.infer<typeof RouteResponseSchema>;

/**
 * Directions response containing routes for all participants to a venue.
 */
export const DirectionsResponseSchema = z.object({
  /** Google Place ID of the destination venue */
  venueId: z.string(),
  /** Travel mode used for calculation */
  travelMode: TravelModeSchema,
  /** Routes for each participant */
  routes: z.array(RouteResponseSchema),
});

export type DirectionsResponse = z.infer<typeof DirectionsResponseSchema>;
