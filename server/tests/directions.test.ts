/**
 * Integration tests for Directions endpoint.
 *
 * Tests the full request/response cycle for route calculation.
 * Mocks Google Directions API to avoid external calls.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

// Mock Directions API module
vi.mock("../src/lib/directions/client.js", () => ({
  fetchDirectionsApi: vi.fn(),
  withRetry: vi.fn((fn) => fn()),
}));

// Mock Places API module for venue lookup fallback
vi.mock("../src/lib/places/index.js", async () => {
  const actual = await vi.importActual("../src/lib/places/index.js");
  return {
    ...actual,
    getPlaceDetails: vi.fn(),
    searchNearbyPlaces: vi.fn().mockResolvedValue([]),
    textSearchPlaces: vi.fn().mockResolvedValue([]),
  };
});

// Mock Geocoding API for participant creation
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockImplementation((address: string) => {
    if (address.includes("Empire State")) {
      return Promise.resolve({
        lat: 40.7484,
        lng: -73.9857,
        formattedAddress: "350 5th Ave, New York, NY 10118, USA",
      });
    }
    if (address.includes("World Trade")) {
      return Promise.resolve({
        lat: 40.7127,
        lng: -74.0134,
        formattedAddress: "1 World Trade Center, New York, NY 10007, USA",
      });
    }
    return Promise.resolve({
      lat: 40.7128,
      lng: -74.006,
      formattedAddress: address,
    });
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

import { fetchDirectionsApi } from "../src/lib/directions/client.js";
import { getPlaceDetails, PlacesApiError } from "../src/lib/places/index.js";

const mockFetchDirectionsApi = fetchDirectionsApi as ReturnType<typeof vi.fn>;
const mockGetPlaceDetails = getPlaceDetails as ReturnType<typeof vi.fn>;

/**
 * Creates a mock directions API response.
 */
function createMockDirectionsResponse(overrides: Partial<{
  distanceValue: number;
  durationValue: number;
}> = {}) {
  return {
    status: "OK",
    routes: [
      {
        legs: [
          {
            distance: { value: overrides.distanceValue ?? 5000, text: "3.1 mi" },
            duration: { value: overrides.durationValue ?? 720, text: "12 mins" },
          },
        ],
        overview_polyline: { points: "encoded_polyline_string" },
      },
    ],
  };
}

describe("Directions Endpoint", () => {
  let server: FastifyInstance;
  let testEventId: string;
  let testOrganizerParticipantToken: string;
  let testParticipantId: string;
  let testParticipantToken: string;
  let testVenueId: string;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a fresh event for each test
    const eventResponse = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "Test Directions Event",
        meetingTime: "2025-01-15T12:00:00Z",
      },
    });

    if (eventResponse.statusCode !== 201) {
      throw new Error(
        `beforeEach failed: event creation returned ${String(eventResponse.statusCode)}: ${JSON.stringify(eventResponse.json())}`
      );
    }

    const event = eventResponse.json();
    testEventId = event.id;
    testOrganizerParticipantToken = event.participantToken;

    // Add a participant with location (self-registration to get participantToken)
    const participantResponse = await server.inject({
      method: "POST",
      url: `/api/events/${testEventId}/participants`,
      payload: {
        name: "Alice",
        address: "Empire State Building, NYC",
      },
    });

    if (participantResponse.statusCode !== 201) {
      throw new Error(
        `beforeEach failed: participant creation returned ${String(participantResponse.statusCode)}: ${JSON.stringify(participantResponse.json())}`
      );
    }

    const participant = participantResponse.json();
    testParticipantId = participant.id;
    testParticipantToken = participant.participantToken;

    // Create venue in database for testing
    testVenueId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    await server.db.venue.upsert({
      where: { id: testVenueId },
      create: {
        id: testVenueId,
        name: "Test Restaurant",
        address: "123 Restaurant St, NYC",
        lat: 40.7500,
        lng: -74.0000,
        category: "restaurant",
        rating: 4.5,
        priceLevel: 2,
        photoUrl: null,
      },
      update: {},
    });
  });

  describe("GET /api/events/:id/venues/:venueId/directions", () => {
    it("returns 401 without authorization header", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toHaveProperty("error.code", "UNAUTHORIZED");
    });

    it("returns 403 with invalid token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: "Bearer invalid_token" },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error.code", "FORBIDDEN");
    });

    it("returns 404 for non-existent event", async () => {
      // Use a valid event ID format that doesn't exist
      const nonExistentEventId = "evt_1234567890123_abcdefghij123456";
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${nonExistentEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty("error.code", "EVENT_NOT_FOUND");
    });

    it("returns 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/invalid-id/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid travel mode", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions?travelMode=flying`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid venue ID (Places API NOT_FOUND)", async () => {
      // Venue not in database, Places API returns NOT_FOUND
      mockGetPlaceDetails.mockRejectedValue(
        new PlacesApiError("Place not found", "NOT_FOUND")
      );

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/ChIJ_nonexistent_venue/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty("error.code", "VALIDATION_ERROR");
    });

    it("calculates routes for venue not in database (Places API fallback)", async () => {
      // Venue not in database, but exists in Places API
      mockGetPlaceDetails.mockResolvedValue({
        placeId: "ChIJ_new_venue_from_search",
        name: "New Cafe",
        address: "456 New St, NYC",
        location: { lat: 40.7600, lng: -73.9800 },
        types: ["cafe"],
        rating: 4.2,
        userRatingsTotal: 50,
        priceLevel: 1,
        openNow: true,
        photoReference: null,
        formattedPhoneNumber: null,
        website: null,
        openingHours: null,
      });
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/ChIJ_new_venue_from_search/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("venueId", "ChIJ_new_venue_from_search");
      // 2 participants: organizer (no location) + Alice (with location)
      expect(body.routes.length).toBe(2);
    });

    it("calculates routes with organizer token", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("venueId", testVenueId);
      expect(body).toHaveProperty("travelMode", "driving");
      expect(body).toHaveProperty("routes");
      expect(body.routes).toBeInstanceOf(Array);
      // 2 participants: organizer (no location) + Alice (with location)
      expect(body.routes.length).toBe(2);

      // Find routes by participantId
      const aliceRoute = body.routes.find((r: { participantId: string }) => r.participantId === testParticipantId);
      const organizerRoute = body.routes.find((r: { participantId: string }) => r.participantId !== testParticipantId);

      // Alice should have route data
      expect(aliceRoute).toHaveProperty("distance");
      expect(aliceRoute).toHaveProperty("duration");
      expect(aliceRoute).toHaveProperty("polyline");
      expect(aliceRoute.distance).not.toBeNull();

      // Organizer should have null values (no location)
      expect(organizerRoute.distance).toBeNull();
      expect(organizerRoute.duration).toBeNull();
      expect(organizerRoute.polyline).toBeNull();
    });

    it("calculates routes with participant token", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("routes");
      // 2 participants: organizer (no location) + Alice (with location)
      expect(body.routes.length).toBe(2);
    });

    it("respects travel mode parameter", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions?travelMode=walking`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("travelMode", "walking");
    });

    it("filters to single participant when participantId provided", async () => {
      // Add another participant
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          name: "Bob",
          address: "World Trade Center, NYC",
        },
      });

      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions?participantId=${testParticipantId}`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.routes.length).toBe(1);
      expect(body.routes[0].participantId).toBe(testParticipantId);
    });

    it("returns formatted distance in imperial units", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse({
        distanceValue: 5000, // ~3.1 miles
      }));

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.routes[0].distance).toHaveProperty("value", 5000);
      expect(body.routes[0].distance.text).toMatch(/mi$/);
    });

    it("returns formatted duration", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse({
        durationValue: 720, // 12 minutes
      }));

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.routes[0].duration).toHaveProperty("value", 720);
      expect(body.routes[0].duration.text).toMatch(/mins?$/);
    });

    it("returns null route data for participants without locations", async () => {
      // Create a new event with only organizer (no location)
      const eventResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: { title: "Empty Participants Event" },
      });
      const event = eventResponse.json();

      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${event.id}/venues/${testVenueId}/directions`,
        headers: { Authorization: `Bearer ${event.participantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      // Organizer is included but with null values (no location)
      expect(body.routes.length).toBe(1);
      expect(body.routes[0].distance).toBeNull();
      expect(body.routes[0].duration).toBeNull();
      expect(body.routes[0].polyline).toBeNull();
    });

    it("supports all travel modes", async () => {
      mockFetchDirectionsApi.mockResolvedValue(createMockDirectionsResponse());

      for (const mode of ["driving", "walking", "transit", "bicycling"]) {
        const response = await server.inject({
          method: "GET",
          url: `/api/events/${testEventId}/venues/${testVenueId}/directions?travelMode=${mode}`,
          headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().travelMode).toBe(mode);
      }
    });
  });
});
