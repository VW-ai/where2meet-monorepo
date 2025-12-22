/**
 * Type definitions for Google Directions API.
 * @module lib/directions/types
 */

/** Supported travel modes */
export type TravelMode = "driving" | "walking" | "transit" | "bicycling";

/** Geographic point for origin/destination */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Distance/duration value with formatted text */
export interface FormattedValue {
  /** Raw value in meters (distance) or seconds (duration) */
  value: number;
  /** Formatted string ("3.2 mi", "12 mins") */
  text: string;
}

/** Normalized route result for a single participant */
export interface RouteResult {
  participantId: string;
  distance: FormattedValue;
  duration: FormattedValue;
  /** Encoded polyline for Google Maps rendering */
  polyline: string;
}

/** Batch directions result for all participants to a venue */
export interface DirectionsResult {
  venueId: string;
  travelMode: TravelMode;
  routes: RouteResult[];
}

// ============================================================================
// Google Directions API Response Types (internal)
// ============================================================================

/** Google Directions API leg (one segment of a route) */
export interface GoogleDirectionsLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_address: string;
  end_address: string;
}

/** Google Directions API route */
export interface GoogleDirectionsRoute {
  legs: GoogleDirectionsLeg[];
  overview_polyline: { points: string };
  summary: string;
  warnings: string[];
}

/** Google Directions API response */
export interface GoogleDirectionsResponse {
  status: string;
  routes: GoogleDirectionsRoute[];
  error_message?: string;
}
