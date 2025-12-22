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
// Voting API Types
// ============================================================================

/**
 * Request to cast a vote for a venue
 * Note: participantId is now in the URL path
 */
export interface CastVoteRequest {
  venueId: string;
  venueData: {
    name: string;
    address?: string;
    lat: number;
    lng: number;
    category?: string;
    rating?: number;
    priceLevel?: number;
    photoUrl?: string;
  };
}

/**
 * Response from casting a vote
 */
export interface CastVoteResponse {
  success: true;
  voteId: string;
}

/**
 * Request to remove a vote for a venue
 * Note: participantId and venueId are now in the URL path
 */
export interface RemoveVoteRequest {
  // Empty - all data is in URL path
}

/**
 * Response from removing a vote
 */
export interface RemoveVoteResponse {
  success: true;
  deleted: boolean; // false if vote didn't exist
}

/**
 * Venue with vote information
 */
export interface VenueWithVotes {
  id: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  photoUrl: string | null;
  voteCount: number;
  voters: string[]; // Array of participant IDs who voted
}

/**
 * Vote statistics response
 */
export interface VoteStatisticsResponse {
  venues: VenueWithVotes[];
  totalVotes: number;
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

// ============================================================================
// Directions API Types (Milestone 6)
// ============================================================================

/**
 * Route information returned by the backend directions API
 */
export interface BackendDirectionsRoute {
  participantId: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  polyline: string;
}

/**
 * Response from GET /api/events/:id/venues/:venueId/directions
 */
export interface BackendDirectionsResponse {
  venueId: string;
  travelMode: string;
  routes: BackendDirectionsRoute[];
}
