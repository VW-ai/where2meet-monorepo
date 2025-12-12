/**
 * Events API
 *
 * Status: MIGRATED to backend (Milestone 2)
 * Calls backend directly at http://localhost:3000
 */

import { Event, CreateEventDTO, UpdateEventDTO } from '@/types';
import { backendCall, apiCall } from './client';

export const eventsApi = {
  create: (data: CreateEventDTO) =>
    backendCall<Event>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => backendCall<Event>(`/api/events/${id}`),

  update: (id: string, data: UpdateEventDTO, token: string) =>
    backendCall<Event>(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  delete: (id: string, token: string) =>
    backendCall<{ success: true; message: string }>(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  // TODO: Migrate when backend Milestone 5 is ready
  publish: (id: string, venueId: string, token: string) =>
    apiCall(`/api/events/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ venueId }),
    }),
};
