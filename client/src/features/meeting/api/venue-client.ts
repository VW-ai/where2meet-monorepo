/**
 * Venue API Client Facade
 * Meeting feature's interface to venue-related backend APIs.
 */

import { venuesApi } from '@/lib/api/venues';

export const venueClient = {
  search: venuesApi.search,
  get: venuesApi.get,
};
