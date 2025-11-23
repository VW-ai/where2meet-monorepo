/**
 * API Client
 *
 * Client-side API client that makes HTTP calls to Next.js API routes
 * The API routes handle mock vs real backend logic server-side
 */

import { Event, VenueSearchRequest, DirectionsRequest, CreateParticipantDTO } from '@/types';

/**
 * API Error class
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Main API call function
 * Makes HTTP calls to Next.js API routes (which handle mock/real backend)
 */
export async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    // Always call Next.js API routes
    // They run server-side and handle mock vs real backend logic
    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || `Request failed with status ${response.status}`,
        errorData.error?.details
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) throw error;

    // Handle network errors
    console.error('[API] Network error:', error);
    throw new APIError(0, 'NETWORK_ERROR', 'Network request failed. Please check your connection.');
  }
}

/**
 * Convenience API methods
 */
export const api = {
  events: {
    create: (data: { title: string; meetingTime: string }) =>
      apiCall<Event>('/api/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => apiCall<Event>(`/api/events/${id}`),

    update: (id: string, data: Partial<{ title: string; meetingTime: string }>, token: string) =>
      apiCall(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    delete: (id: string, token: string) =>
      apiCall(`/api/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    publish: (id: string, venueId: string, token: string) =>
      apiCall(`/api/events/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId }),
      }),
  },

  participants: {
    add: (eventId: string, data: CreateParticipantDTO) =>
      apiCall(`/api/events/${eventId}/participants`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (eventId: string, participantId: string, data: Partial<CreateParticipantDTO>) =>
      apiCall(`/api/events/${eventId}/participants/${participantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    remove: (eventId: string, participantId: string) =>
      apiCall(`/api/events/${eventId}/participants/${participantId}`, {
        method: 'DELETE',
      }),
  },

  venues: {
    search: (data: VenueSearchRequest) =>
      apiCall('/api/venues/search', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => apiCall(`/api/venues/${id}`),
  },

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
