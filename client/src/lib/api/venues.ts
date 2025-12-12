/**
 * Venues API
 *
 * Status: MOCK (Next.js API routes)
 * TODO: Migrate when backend Milestone 4 is ready
 */

import { VenueSearchRequest } from '@/types';
import { apiCall } from './client';

export const venuesApi = {
  search: (data: VenueSearchRequest) =>
    apiCall('/api/venues/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => apiCall(`/api/venues/${id}`),
};
