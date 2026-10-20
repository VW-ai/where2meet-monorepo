/**
 * Venues API
 *
 * Status: BACKEND (Milestone 4)
 * Endpoints:
 * - POST /api/venues/search - Search venues near event center. An optional eventId and
 *   Bearer token attribute the search to a meeting and participant; neither is required.
 * - GET /api/venues/:id - Get venue details
 */

import { Venue } from '@/entities';
import { VenueSearchRequest, VenueSearchResponse } from '@/shared/types/api';
import { backendCall } from './client';

/**
 * Venue details response from backend
 * Same as Venue but with guaranteed detail fields (may be null)
 */
type VenueDetailsResponse = Venue;

export const venuesApi = {
  /**
   * Search for venues near the event's participant center (MEC)
   * Requires at least one of: query or categories
   *
   * @param data - Search parameters, with eventId when searching from a meeting
   * @param token - organizerToken or participantToken, sent only when given
   */
  search: (data: VenueSearchRequest, token?: string) =>
    backendCall<VenueSearchResponse>('/api/venues/search', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: JSON.stringify(data),
    }),

  /**
   * Get detailed information about a specific venue
   */
  get: (placeId: string) => backendCall<VenueDetailsResponse>(`/api/venues/${placeId}`),
};
