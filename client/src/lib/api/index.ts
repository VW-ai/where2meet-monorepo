/**
 * API Module
 *
 * Unified export for all API methods.
 * Import with: import { api } from '@/lib/api'
 */

import { eventsApi } from './events';
import { participantsApi } from './participants';
import { venuesApi } from './venues';
import { geoApi } from './geo';

export { APIError } from './client';

export const api = {
  events: eventsApi,
  participants: participantsApi,
  venues: venuesApi,
  geocode: geoApi.geocode,
  directions: geoApi.directions,
};
