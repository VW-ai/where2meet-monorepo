/**
 * API-related type definitions
 */

import { Location, TravelMode, Route } from './map';
import { Venue, VenueCategory } from './venue';

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface VenueSearchRequest {
  center: Location;
  radius: number; // In meters
  categories?: VenueCategory[];
  travelMode?: TravelMode;
}

export interface VenueSearchResponse {
  venues: Venue[];
  totalResults: number;
}

export interface DirectionsRequest {
  origins: Location[];
  destination: Location;
  travelMode: TravelMode;
}

export interface DirectionsResponse {
  routes: Route[];
}

// ============================================================================
// API Error Types
// ============================================================================

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// UI State Types
// ============================================================================

export type ActiveSection = 'participants' | 'venues';

export interface AnalyticsData {
  participantId: string;
  participantName: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  color: string;
}
