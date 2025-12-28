/**
 * Directions API Client Facade
 * Meeting feature's interface to directions-related backend APIs.
 */

import { directionsApi } from '@/lib/api/directions';

export const directionsClient = {
  getDirections: directionsApi.getDirections,
};

// Re-export types for convenience
export type { DirectionsRoute, DirectionsResponse } from '@/lib/api/directions';
