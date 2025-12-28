/**
 * Events API
 *
 * Status: MIGRATED to backend (Milestone 2, Publish/Unpublish in Milestone 6)
 * Calls backend directly at http://localhost:3000
 */

import { Event, CreateEventDTO, UpdateEventDTO } from '@/entities';
import { ParticipantResponse } from '@/entities/participant/types';
import { backendCall } from './client';

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

  /**
   * Publish an event with a selected venue
   * Validates venue via Google Places API before publishing
   */
  publish: (id: string, venueId: string, token: string) =>
    backendCall<Event>(`/api/events/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ venueId }),
    }),

  /**
   * Unpublish an event to allow further modifications
   */
  unpublish: (id: string, token: string) =>
    backendCall<Event>(`/api/events/${id}/publish`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Get the current participant's information for this event
   * Returns participant details with isOrganizer flag for role detection
   */
  getMe: (id: string, token: string) =>
    backendCall<ParticipantResponse>(`/api/events/${id}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
