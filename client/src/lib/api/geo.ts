/**
 * Geocoding & Directions API
 *
 * Status: MOCK (Next.js API routes)
 * These may remain as Next.js routes since they proxy to Google Maps API
 */

import { DirectionsRequest } from '@/shared/types/api';
import { apiCall } from './client';

export const geoApi = {
  geocode: (address: string) =>
    apiCall('/api/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  directions: (data: DirectionsRequest) =>
    apiCall('/api/directions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
