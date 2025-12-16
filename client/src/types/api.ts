/**
 * API-related type definitions
 */

import { Location, TravelMode, Route } from './map';
import { Venue, VenueCategory } from './venue';

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Venue search request for backend API
 */
export interface VenueSearchRequest {
  eventId: string;
  searchRadius: number; // meters (100-50000)
  query?: string; // text search
  categories?: VenueCategory[]; // category filter
}

/**
 * Venue search response from backend API
 */
export interface VenueSearchResponse {
  venues: Venue[];
  totalResults: number;
  searchCenter: Location; // MEC center of all participants
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
