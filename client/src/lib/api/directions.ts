/**
 * Directions API
 *
 * Status: MIGRATED to backend (Milestone 6)
 * Calls backend directly at http://localhost:3000
 */

import type { TravelMode, Distance, Duration } from '@/types';
import { backendCall } from './client';

/**
 * Route information returned by the backend directions API
 */
export interface DirectionsRoute {
  participantId: string;
  distance: Distance;
  duration: Duration;
  polyline: string;
}

/**
 * Response from the backend directions API
 */
export interface DirectionsResponse {
  venueId: string;
  travelMode: string;
  routes: DirectionsRoute[];
}

export const directionsApi = {
  /**
   * Get directions from all participants to a venue
   *
   * @param eventId - The event ID
   * @param venueId - The venue (place) ID
   * @param travelMode - Travel mode (driving, walking, transit, bicycling)
   * @param token - Authorization token (organizer or participant)
   */
  getDirections: (
    eventId: string,
    venueId: string,
    travelMode: TravelMode,
    token: string
  ): Promise<DirectionsResponse> =>
    backendCall<DirectionsResponse>(
      `/api/events/${eventId}/venues/${venueId}/directions?travelMode=${travelMode}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};
