/**
 * API Module
 *
 * Unified export for all API methods.
 * Import with: import { api } from '@/lib/api'
 */

import { authApi } from './auth';
import { usersApi } from './users';
import { eventsApi } from './events';
import { participantsApi } from './participants';
import { venuesApi } from './venues';
import { votesApi } from './votes';
import { geoApi } from './geo';
import { directionsApi } from './directions';

export { APIError } from './client';

export const api = {
  auth: authApi,
  users: usersApi,
  events: eventsApi,
  participants: participantsApi,
  venues: venuesApi,
  votes: votesApi,
  geocode: geoApi.geocode,
  directions: directionsApi,
};
