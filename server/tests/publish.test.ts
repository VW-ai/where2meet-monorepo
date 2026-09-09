/**
 * Integration tests for Publish/Unpublish endpoints.
 *
 * Tests the full request/response cycle for publishing and unpublishing events.
 * Mocks Google Places API for venue validation.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

// Mock Places API module for venue validation
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
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7128,
    lng: -74.006,
    formattedAddress: "123 Main Street, New York, NY 10001",
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

import { getPlaceDetails, PlacesApiError } from "../src/lib/places/index.js";

const mockGetPlaceDetails = getPlaceDetails as ReturnType<typeof vi.fn>;

/**
 * Creates a mock place details response.
 */
function createMockPlaceDetails(overrides: Partial<{
  placeId: string;
  name: string;
}> = {}) {
  return {
    placeId: overrides.placeId ?? "ChIJ_valid_venue_id",
    name: overrides.name ?? "Test Restaurant",
    address: "123 Restaurant St, NYC",
    location: { lat: 40.7500, lng: -74.0000 },
    types: ["restaurant"],
    rating: 4.5,
    userRatingsTotal: 100,
    priceLevel: 2,
    openNow: true,
    photoReference: null,
    formattedPhoneNumber: null,
    website: null,
    openingHours: null,
  };
}

describe("Publish Endpoints", () => {
  let server: FastifyInstance;
  let testEventId: string;
  let testOrganizerParticipantToken: string;
  let testParticipantId: string;
  let testParticipantToken: string;
  const testVenueId = "ChIJ_valid_venue_id";

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
        title: "Test Publish Event",
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

    // Add a participant (self-registration to get participantToken)
    const participantResponse = await server.inject({
      method: "POST",
      url: `/api/events/${testEventId}/participants`,
      payload: {
        name: "Alice",
        address: "123 Main St",
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
  });

  describe("POST /api/events/:id/publish", () => {
    it("returns 401 without authorization header", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toHaveProperty("error.code", "UNAUTHORIZED");
    });

    it("returns 403 with invalid token", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: "Bearer invalid_token" },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error.code", "FORBIDDEN");
    });

    it("returns 403 with participant token (organizer only)", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error.code", "FORBIDDEN");
    });

    it("returns 404 for non-existent event", async () => {
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails());
      const nonExistentEventId = "evt_1234567890123_abcdefghij123456";

      const response = await server.inject({
        method: "POST",
        url: `/api/events/${nonExistentEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty("error.code", "EVENT_NOT_FOUND");
    });

    it("returns 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/invalid-id/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for missing venueId", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid venueId (Places API NOT_FOUND)", async () => {
      mockGetPlaceDetails.mockRejectedValue(
        new PlacesApiError("Place not found", "NOT_FOUND")
      );

      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: "ChIJ_invalid_venue" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty("error.code", "VALIDATION_ERROR");
    });

    it("publishes event with valid organizer token", async () => {
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails({ placeId: testVenueId }));

      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("id", testEventId);
      expect(body).toHaveProperty("publishedVenueId", testVenueId);
      expect(body).toHaveProperty("publishedAt");
      expect(body.publishedAt).not.toBeNull();
    });

    it("returns 409 when already published", async () => {
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails({ placeId: testVenueId }));

      // First publish
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      // Second publish should fail
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
    });
  });

  describe("DELETE /api/events/:id/publish", () => {
    beforeEach(async () => {
      // Publish the event first for unpublish tests
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails({ placeId: testVenueId }));
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });
    });

    it("returns 401 without authorization header", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toHaveProperty("error.code", "UNAUTHORIZED");
    });

    it("returns 403 with invalid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: "Bearer invalid_token" },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error.code", "FORBIDDEN");
    });

    it("returns 403 with participant token (organizer only)", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty("error.code", "FORBIDDEN");
    });

    it("unpublishes event with valid organizer token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("id", testEventId);
      expect(body).toHaveProperty("publishedVenueId", null);
      expect(body).toHaveProperty("publishedAt", null);
    });

    it("returns 409 when not published", async () => {
      // Unpublish first
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      // Second unpublish should fail
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_NOT_PUBLISHED");
    });
  });

  describe("Post-publish restrictions", () => {
    beforeEach(async () => {
      // Create venue in database for voting tests
      await server.db.venue.upsert({
        where: { id: testVenueId },
        create: {
          id: testVenueId,
          name: "Test Restaurant",
          address: "123 Restaurant St",
          lat: 40.75,
          lng: -74.0,
          category: "restaurant",
          rating: 4.5,
          priceLevel: 2,
          photoUrl: null,
        },
        update: {},
      });

      // Publish the event for restriction tests
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails({ placeId: testVenueId }));
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });
    });

    it("returns 409 when adding participant after publish", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          name: "Bob",
          address: "456 Other St",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
    });

    it("returns 409 when updating participant after publish", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${testParticipantId}`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
        payload: {
          name: "Alice Updated",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
    });

    it("returns 409 when deleting participant after publish", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
    });

    it("returns 409 when voting after publish", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: testVenueId,
          venueData: {
            name: "Test Restaurant",
            address: "123 Restaurant St",
            lat: 40.75,
            lng: -74.0,
            rating: 4.5,
            priceLevel: 2,
            category: "restaurant",
            photoUrl: null,
          },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
    });
  });

  describe("Post-unpublish behavior", () => {
    beforeEach(async () => {
      // Publish then unpublish
      mockGetPlaceDetails.mockResolvedValue(createMockPlaceDetails({ placeId: testVenueId }));
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: { venueId: testVenueId },
      });
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/publish`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
      });
    });

    it("allows adding participant after unpublish", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { Authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          name: "Bob",
          address: "456 Other St",
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it("allows voting after unpublish", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { Authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: testVenueId,
          venueData: {
            name: "Test Restaurant",
            address: "123 Restaurant St",
            lat: 40.75,
            lng: -74.0,
            rating: 4.5,
            priceLevel: 2,
            category: "restaurant",
            photoUrl: null,
          },
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});
