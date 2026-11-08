/**
 * Directions API
 *
 * Status: MIGRATED to backend (Milestone 6)
 * Calls backend directly at http://localhost:3000
 */

import type { TravelMode, Distance, Duration } from '@/shared/types/map';
import { backendCall } from './client';

/**
 * Route information returned by the backend directions API
 */
export interface DirectionsRoute {
  participantId: string;
  distance: Distance;
  duration: Duration;
  polyline: string;
  travelMode: TravelMode;
}

/**
 * Response from the backend directions API
 */
export interface DirectionsResponse {
  venueId: string;
  travelMode: TravelMode | null;
  routes: DirectionsRoute[];
}

type RawRoute = Omit<DirectionsRoute, 'distance' | 'duration' | 'polyline' | 'travelMode'> & {
  distance: Distance | null;
  duration: Duration | null;
  polyline: string | null;
  travelMode?: TravelMode;
};

type RawResponse = Omit<DirectionsResponse, 'routes' | 'travelMode'> & {
  travelMode?: TravelMode | null;
  routes: RawRoute[];
};

/** Someone with no starting point comes back as nulls: past here, a route is always a real one. */
export function parseDirections(raw: RawResponse): DirectionsResponse {
  const routes = raw.routes.flatMap(({ distance, duration, polyline, travelMode, ...route }) =>
    distance && duration && polyline
      ? [
          {
            ...route,
            distance,
            duration,
            polyline,
            travelMode: travelMode ?? raw.travelMode ?? 'driving',
          },
        ]
      : []
  );
  return { ...raw, travelMode: raw.travelMode ?? null, routes };
}

export const directionsApi = {
  /**
   * Get directions to a venue
   *
   * @param eventId - The event ID
   * @param venueId - The venue (place) ID
   * @param token - Authorization token (organizer or participant)
   * @param options.travelMode - Overrides everyone's mode. Omit to use each person's own
   * @param options.participantId - Only this person. Omit for everyone
   */
  getDirections: (
    eventId: string,
    venueId: string,
    token: string,
    options: { travelMode?: TravelMode; participantId?: string } = {}
  ): Promise<DirectionsResponse> => {
    const params = new URLSearchParams();
    if (options.travelMode) params.set('travelMode', options.travelMode);
    if (options.participantId) params.set('participantId', options.participantId);
    const query = params.size > 0 ? `?${params}` : '';
    return backendCall<RawResponse>(`/api/events/${eventId}/venues/${venueId}/directions${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(parseDirections);
  },
};
