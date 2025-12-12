/**
 * Mock API Client
 *
 * Simulates API calls with in-memory data
 * Provides realistic network delays and error handling
 */

import { mockStore } from '@/mock-server/store';
import {
  VenueSearchResponse,
  CreateEventDTO,
  CreateParticipantDTO,
  GeocodeResult,
  Location,
} from '@/types';

// Simulate network delay (200-500ms)
const delay = (ms: number = 300) =>
  new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 200));

export async function mockApiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  await delay(); // Simulate network latency

  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;

  // ============================================================================
  // Event Endpoints
  // ============================================================================

  // POST /api/events - Create event
  if (endpoint === '/api/events' && method === 'POST') {
    const data = body as CreateEventDTO;
    const event = mockStore.createEvent({
      title: data.title,
      meetingTime: data.meetingTime || null,
      organizerToken: `mock_token_${Date.now()}`,
      updatedAt: new Date().toISOString(),
      mec: null,
      publishedVenueId: null,
      publishedAt: null,
      settings: { allowParticipantsAfterPublish: false },
    });
    return event as T;
  }

  // GET /api/events/:id - Get event
  const getEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (getEventMatch && method === 'GET') {
    const event = mockStore.getEvent(getEventMatch[1]);
    if (!event) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Event not found');
    }
    return event as T;
  }

  // PATCH /api/events/:id - Update event
  const updateEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (updateEventMatch && method === 'PATCH') {
    const event = mockStore.updateEvent(updateEventMatch[1], body);
    if (!event) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Event not found');
    }
    return event as T;
  }

  // DELETE /api/events/:id - Delete event
  const deleteEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (deleteEventMatch && method === 'DELETE') {
    const success = mockStore.deleteEvent(deleteEventMatch[1]);
    if (!success) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Event not found');
    }
    return { success: true, message: 'Event deleted successfully' } as T;
  }

  // POST /api/events/:eventId/publish - Publish event
  const publishEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)\/publish$/);
  if (publishEventMatch && method === 'POST') {
    const { venueId } = body;
    const event = mockStore.updateEvent(publishEventMatch[1], {
      publishedVenueId: venueId,
      publishedAt: new Date().toISOString(),
    });
    if (!event) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Event not found');
    }
    return event as T;
  }

  // ============================================================================
  // Participant Endpoints
  // ============================================================================

  // POST /api/events/:eventId/participants - Add participant
  const addParticipantMatch = endpoint.match(/^\/api\/events\/([^\/]+)\/participants$/);
  if (addParticipantMatch && method === 'POST') {
    const data = body as CreateParticipantDTO;
    const participant = await mockStore.addParticipant(addParticipantMatch[1], {
      name: data.name,
      address: data.address,
      fuzzyLocation: data.fuzzyLocation || false,
    });
    if (!participant) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Event not found');
    }
    return participant as T;
  }

  // PATCH /api/events/:eventId/participants/:participantId - Update participant
  const updateParticipantMatch = endpoint.match(
    /^\/api\/events\/([^\/]+)\/participants\/([^\/]+)$/
  );
  if (updateParticipantMatch && method === 'PATCH') {
    const participant = await mockStore.updateParticipant(
      updateParticipantMatch[1],
      updateParticipantMatch[2],
      body
    );
    if (!participant) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Participant not found');
    }
    return participant as T;
  }

  // DELETE /api/events/:eventId/participants/:participantId - Remove participant
  const deleteParticipantMatch = endpoint.match(
    /^\/api\/events\/([^\/]+)\/participants\/([^\/]+)$/
  );
  if (deleteParticipantMatch && method === 'DELETE') {
    const success = mockStore.removeParticipant(
      deleteParticipantMatch[1],
      deleteParticipantMatch[2]
    );
    if (!success) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Participant not found');
    }
    return {
      success: true,
      message: 'Participant removed successfully',
    } as T;
  }

  // ============================================================================
  // Venue Endpoints
  // ============================================================================

  // POST /api/venues/search - Search venues
  if (endpoint === '/api/venues/search' && method === 'POST') {
    const { center, radius, categories } = body;
    const venues = mockStore.searchVenues(center, radius, categories);
    const response: VenueSearchResponse = {
      venues,
      totalResults: venues.length,
    };
    return response as T;
  }

  // GET /api/venues/:id - Get venue details
  const getVenueMatch = endpoint.match(/^\/api\/venues\/([^\/]+)$/);
  if (getVenueMatch && method === 'GET') {
    const venue = mockStore.getVenue(getVenueMatch[1]);
    if (!venue) {
      throw new MockAPIError(404, 'NOT_FOUND', 'Venue not found');
    }
    return venue as T;
  }

  // ============================================================================
  // Geocoding & Directions
  // ============================================================================

  // POST /api/geocode - Geocode address (mock)
  if (endpoint === '/api/geocode' && method === 'POST') {
    const { address } = body;
    const result: GeocodeResult = {
      address,
      location: {
        lat: 40.7128 + Math.random() * 0.1 - 0.05,
        lng: -74.006 + Math.random() * 0.1 - 0.05,
      },
      placeId: `mock_place_${Date.now()}`,
    };
    return result as T;
  }

  // POST /api/directions - Get directions (mock)
  if (endpoint === '/api/directions' && method === 'POST') {
    const { origins } = body;
    const routes = origins.map((_origin: Location, index: number) => ({
      participantIndex: index,
      distance: {
        text: `${(Math.random() * 10 + 1).toFixed(1)} km`,
        value: Math.floor(Math.random() * 10000 + 1000),
      },
      duration: {
        text: `${Math.floor(Math.random() * 30 + 5)} mins`,
        value: Math.floor(Math.random() * 1800 + 300),
      },
      polyline: 'mock_polyline_data',
    }));

    return { routes } as T;
  }

  throw new MockAPIError(
    404,
    'NOT_IMPLEMENTED',
    `Mock API endpoint not implemented: ${method} ${endpoint}`
  );
}

/**
 * Mock API Error class
 */
class MockAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'MockAPIError';
  }
}
