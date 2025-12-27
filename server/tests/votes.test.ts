/**
 * Integration tests for Vote endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../src/generated/prisma/index.js";

// Mock the geocode function
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7128,
    lng: -74.006,
    formattedAddress: "123 Main Street, New York, NY 10001",
  }),
  AddressNotFoundError: class AddressNotFoundError extends Error {
    constructor(address: string) {
      super(`Address not found: ${address}`);
      this.name = "AddressNotFoundError";
    }
  },
  GeocodingApiError: class GeocodingApiError extends Error {
    constructor(
      message: string,
      public readonly status: string
    ) {
      super(message);
      this.name = "GeocodingApiError";
    }
  },
}));

describe("Vote Endpoints", () => {
  let server: FastifyInstance;
  let db: PrismaClient;
  let testEventId: string;
  let testOrganizerToken: string;
  let organizerParticipantId: string;
  let testParticipantId: string;
  let testParticipantToken: string;
  let secondParticipantId: string;

  beforeAll(async () => {
    server = await buildServer();
    db = server.db;
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
        title: "Test Voting Event",
        meetingTime: "2025-01-15T12:00:00Z",
      },
    });

    // Fail fast if event creation fails
    if (eventResponse.statusCode !== 201) {
      throw new Error(
        `beforeEach failed: event creation returned ${eventResponse.statusCode}: ${JSON.stringify(eventResponse.json())}`
      );
    }

    const event = eventResponse.json();
    testEventId = event.id;
    testOrganizerToken = event.organizerToken;
    organizerParticipantId = event.organizerParticipantId;

    // Add a participant (self-registration to get participantToken)
    const participantResponse = await server.inject({
      method: "POST",
      url: `/api/events/${testEventId}/participants`,
      payload: {
        name: "Alice",
        address: "123 Main St",
      },
    });

    // Fail fast if participant creation fails
    if (participantResponse.statusCode !== 201) {
      throw new Error(
        `beforeEach failed: participant creation returned ${participantResponse.statusCode}: ${JSON.stringify(participantResponse.json())}`
      );
    }

    const participant = participantResponse.json();
    testParticipantId = participant.id;
    testParticipantToken = participant.participantToken;

    // Add a second participant via organizer
    const participant2Response = await server.inject({
      method: "POST",
      url: `/api/events/${testEventId}/participants`,
      headers: { authorization: `Bearer ${testOrganizerToken}` },
      payload: {
        name: "Bob",
        address: "456 Oak Ave",
      },
    });

    // Fail fast if second participant creation fails
    if (participant2Response.statusCode !== 201) {
      throw new Error(
        `beforeEach failed: second participant creation returned ${participant2Response.statusCode}: ${JSON.stringify(participant2Response.json())}`
      );
    }

    secondParticipantId = participant2Response.json().id;
  });

  describe("POST /api/events/:id/votes", () => {
    const mockVenueData = {
      name: "Cozy Cafe",
      address: "789 Pine Rd, New York, NY",
      lat: 40.7484,
      lng: -73.9857,
      rating: 4.5,
      priceLevel: 2,
      category: "cafe",
      photoUrl: "https://example.com/photo.jpg",
    };

    it("should cast a vote successfully with participantToken", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty("voteId");
    });

    it("should cast a vote successfully with organizerToken", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty("voteId");
    });

    it("should persist venue to global table when voting", async () => {
      const venueId = "ChIJN1t_tDeuEmsRUsoyG83frY4";

      // Vote to trigger venue creation
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      // Verify venue exists in database
      const venue = await db.venue.findUnique({ where: { id: venueId } });
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe("Cozy Cafe");
      expect(venue?.address).toBe("789 Pine Rd, New York, NY");
      expect(Number(venue?.lat)).toBe(40.7484);
      expect(Number(venue?.lng)).toBe(-73.9857);
      expect(venue?.category).toBe("cafe");
    });

    it("should handle duplicate votes idempotently", async () => {
      const venueId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
      const votePayload = {
        venueId,
        venueData: mockVenueData,
      };

      // First vote
      const response1 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: votePayload,
      });

      expect(response1.statusCode).toBe(201);
      const body1 = response1.json();
      const firstVoteId = body1.voteId;

      // Duplicate vote (same participant, same venue, same event)
      const response2 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: votePayload,
      });

      expect(response2.statusCode).toBe(201);
      const body2 = response2.json();
      expect(body2.success).toBe(true);
      // Should return the same vote ID (idempotent)
      expect(body2.voteId).toBe(firstVoteId);

      // Verify only one vote exists in database
      const votes = await db.vote.findMany({
        where: { eventId: testEventId, participantId: testParticipantId, venueId },
      });
      expect(votes).toHaveLength(1);
    });

    it("should allow participant to vote for multiple venues", async () => {
      const venue1 = "ChIJN1t_tDeuEmsRUsoyG83frY4";
      const venue2 = "ChIJOwg_06VPwokRYv534QaPC8g";

      // Vote for first venue
      const response1 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1,
          venueData: mockVenueData,
        },
      });

      // Vote for second venue
      const response2 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue2,
          venueData: { ...mockVenueData, name: "Pizza Place" },
        },
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);

      // Verify both votes exist
      const votes = await db.vote.findMany({
        where: { eventId: testEventId, participantId: testParticipantId },
      });
      expect(votes).toHaveLength(2);
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: "Bearer invalid-token" },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when participant tries to vote for another participant", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${secondParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should reject organizer trying to vote for another participant", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${secondParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/evt_1702000000000_nonexistent12345/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 404 for non-existent participant", async () => {
      // Use testParticipantToken but with a non-existent participant ID in URL
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/550e8400-e29b-41d4-a716-446655440000/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      // Should get 403 FORBIDDEN because selfOnly hook checks participantId from token doesn't match URL
      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 409 when voting on a published event", async () => {
      // Publish the event
      await db.event.update({
        where: { id: testEventId },
        data: { publishedAt: new Date() },
      });

      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_ALREADY_PUBLISHED");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          // Missing venueId and venueData
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid venue data", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          venueData: {
            name: "Cafe",
            // Missing required lat/lng
            address: "123 Main St",
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /api/events/:id/votes", () => {
    const venueId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const mockVenueData = {
      name: "Cozy Cafe",
      address: "789 Pine Rd",
      lat: 40.7484,
      lng: -73.9857,
    };

    beforeEach(async () => {
      // Cast a vote before each delete test
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });
    });

    it("should remove a vote successfully with participantToken", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toBe(true);

      // Verify vote is actually deleted
      const vote = await db.vote.findUnique({
        where: {
          eventId_participantId_venueId: {
            eventId: testEventId,
            participantId: testParticipantId,
            venueId,
          },
        },
      });
      expect(vote).toBeNull();
    });

    it("should remove a vote successfully with organizerToken", async () => {
      // First, organizer needs to vote for themselves
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      // Now organizer can delete their own vote
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toBe(true);
    });

    it("should be idempotent when removing non-existent vote", async () => {
      const nonExistentVenueId = "ChIJOwg_06VPwokRYv534QaPC8g";

      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${nonExistentVenueId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toBe(false); // Indicates vote didn't exist
    });

    it("should not delete venue from global table when removing vote", async () => {
      // Remove the vote
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Verify venue still exists in global table
      const venue = await db.venue.findUnique({ where: { id: venueId } });
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe("Cozy Cafe");
    });

    it("should return 403 when participant tries to remove another participant's vote", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${secondParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should reject organizer trying to remove another participant's vote", async () => {
      // Organizer tries to remove testParticipant's vote (not their own)
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
        headers: { authorization: "Bearer invalid-token" },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /api/events/:id/votes/statistics (snapshot endpoint)", () => {
    const venue1Id = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    const mockVenue1Data = {
      name: "Cozy Cafe",
      address: "789 Pine Rd",
      lat: 40.7484,
      lng: -73.9857,
      rating: 4.5,
      priceLevel: 2,
      category: "cafe",
      photoUrl: "https://example.com/cafe.jpg",
    };

    it("should return snapshot with eventId and seq number", async () => {
      // Cast a vote to trigger sequence increment
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes/statistics`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Verify snapshot structure
      expect(body.eventId).toBe(testEventId);
      expect(body.seq).toBeGreaterThanOrEqual(0);
      expect(body.venues).toHaveLength(1);
      expect(body.totalVotes).toBe(1);
      expect(body.updatedAt).toBeDefined();
      expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);

      // Verify venue data structure
      const venue = body.venues[0];
      expect(venue.venueId).toBe(venue1Id);
      expect(venue.voteCount).toBe(1);
      expect(venue.voterIds).toEqual([testParticipantId]);
    });

    it("should return empty snapshot with seq=0 for event with no votes", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes/statistics`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.eventId).toBe(testEventId);
      expect(body.seq).toBe(0);
      expect(body.venues).toEqual([]);
      expect(body.totalVotes).toBe(0);
      expect(body.updatedAt).toBeDefined();
    });

    it("should include voterIds array for each venue", async () => {
      // Multiple participants vote for same venue
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // Create another participant
      const participant3Response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "Charlie",
          address: "321 Elm St",
        },
      });
      const participant3 = participant3Response.json();
      const participant3Id = participant3.id;
      const participant3Token = participant3.participantToken;

      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${participant3Id}/votes`,
        headers: { authorization: `Bearer ${participant3Token}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes/statistics`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);

      const venue = body.venues[0];
      expect(venue.voterIds).toHaveLength(2);
      expect(venue.voterIds).toContain(testParticipantId);
      expect(venue.voterIds).toContain(participant3Id);
    });

    it("should not require authentication (public endpoint)", async () => {
      // Cast a vote first
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // Get snapshot without auth
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes/statistics`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/evt_1702000000000_nonexistent12345/votes/statistics",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-id/votes/statistics",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/events/:id/votes", () => {
    const venue1Id = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const venue2Id = "ChIJOwg_06VPwokRYv534QaPC8g";

    const mockVenue1Data = {
      name: "Cozy Cafe",
      address: "789 Pine Rd",
      lat: 40.7484,
      lng: -73.9857,
      rating: 4.5,
      priceLevel: 2,
      category: "cafe",
      photoUrl: "https://example.com/cafe.jpg",
    };

    const mockVenue2Data = {
      name: "Pizza Palace",
      address: "456 Oak Ave",
      lat: 40.7589,
      lng: -73.9851,
      rating: 4.2,
      priceLevel: 1,
      category: "restaurant",
      photoUrl: "https://example.com/pizza.jpg",
    };

    it("should return empty statistics for event with no votes", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toEqual([]);
      expect(body.totalVotes).toBe(0);
    });

    it("should return vote statistics with venue details", async () => {
      // Cast votes
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);
      expect(body.totalVotes).toBe(1);

      const venue = body.venues[0];
      expect(venue.id).toBe(venue1Id);
      expect(venue.name).toBe("Cozy Cafe");
      expect(venue.address).toBe("789 Pine Rd");
      expect(venue.location).toEqual({ lat: 40.7484, lng: -73.9857 });
      expect(venue.rating).toBe(4.5);
      expect(venue.priceLevel).toBe(2);
      expect(venue.category).toBe("cafe");
      expect(venue.photoUrl).toBe("https://example.com/cafe.jpg");
      expect(venue.voteCount).toBe(1);
      expect(venue.voters).toEqual([testParticipantId]);
    });

    it("should aggregate votes across multiple participants", async () => {
      // Both participants vote for venue1
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // Need to get secondParticipant's token to vote as them
      // Create a third participant with self-registration to get their token
      const participant3Response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "Charlie",
          address: "321 Elm St",
        },
      });
      const participant3 = participant3Response.json();
      const participant3Id = participant3.id;
      const participant3Token = participant3.participantToken;

      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${participant3Id}/votes`,
        headers: { authorization: `Bearer ${participant3Token}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);
      expect(body.totalVotes).toBe(2);

      const venue = body.venues[0];
      expect(venue.voteCount).toBe(2);
      expect(venue.voters).toHaveLength(2);
      expect(venue.voters).toContain(testParticipantId);
      expect(venue.voters).toContain(participant3Id);
    });

    it("should return statistics for multiple venues sorted by vote count", async () => {
      // 2 votes for venue1
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // Create another participant to vote for venue1
      const participant3Response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "Charlie",
          address: "321 Elm St",
        },
      });
      const participant3 = participant3Response.json();
      const participant3Id = participant3.id;
      const participant3Token = participant3.participantToken;

      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${participant3Id}/votes`,
        headers: { authorization: `Bearer ${participant3Token}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // 1 vote for venue2
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue2Id,
          venueData: mockVenue2Data,
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(2);
      expect(body.totalVotes).toBe(3);

      // Venues should be sorted by vote count (descending)
      expect(body.venues[0].id).toBe(venue1Id);
      expect(body.venues[0].voteCount).toBe(2);
      expect(body.venues[1].id).toBe(venue2Id);
      expect(body.venues[1].voteCount).toBe(1);
    });

    it("should not require authentication (public endpoint)", async () => {
      // Cast a vote first
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: venue1Id,
          venueData: mockVenue1Data,
        },
      });

      // Get statistics without auth
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/evt_1702000000000_nonexistent12345/votes",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-id/votes",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Global venue table and cascade deletes", () => {
    // Use unique venue IDs per test run to avoid cross-test contamination
    const uniqueId = () => `venue_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const mockVenueData = {
      name: "Shared Venue",
      address: "789 Pine Rd",
      lat: 40.7484,
      lng: -73.9857,
      rating: 4.5,
      priceLevel: 2,
      category: "cafe",
      photoUrl: "https://example.com/photo.jpg",
    };

    it("should share the same venue across multiple events", async () => {
      const sharedVenueId = uniqueId();

      // Create second event
      const event2Response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: { title: "Second Event" },
      });
      const event2 = event2Response.json();
      const event2Id = event2.id;

      // Add participant to second event (self-registration)
      const participant2Response = await server.inject({
        method: "POST",
        url: `/api/events/${event2Id}/participants`,
        payload: { name: "Charlie", address: "999 Elm St" },
      });
      const participant2 = participant2Response.json();
      const participant2Id = participant2.id;
      const participant2Token = participant2.participantToken;

      // Vote for same venue in both events
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: sharedVenueId,
          venueData: mockVenueData,
        },
      });

      await server.inject({
        method: "POST",
        url: `/api/events/${event2Id}/participants/${participant2Id}/votes`,
        headers: { authorization: `Bearer ${participant2Token}` },
        payload: {
          venueId: sharedVenueId,
          venueData: mockVenueData,
        },
      });

      // Verify only 1 venue row exists
      const venues = await db.venue.findMany({ where: { id: sharedVenueId } });
      expect(venues).toHaveLength(1);

      // Verify 2 vote rows exist for this venue
      const votes = await db.vote.findMany({ where: { venueId: sharedVenueId } });
      expect(votes).toHaveLength(2);
    });

    it("should cascade delete votes when event is deleted", async () => {
      const cascadeVenueId = uniqueId();

      // Cast a vote
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: cascadeVenueId,
          venueData: mockVenueData,
        },
      });

      // Verify vote exists for this event
      const votesBefore = await db.vote.findMany({
        where: { eventId: testEventId, venueId: cascadeVenueId }
      });
      expect(votesBefore).toHaveLength(1);

      // Delete event
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      // Verify votes are deleted
      const votesAfter = await db.vote.findMany({
        where: { eventId: testEventId, venueId: cascadeVenueId }
      });
      expect(votesAfter).toHaveLength(0);

      // Verify venue still exists (not deleted with event)
      const venue = await db.venue.findUnique({ where: { id: cascadeVenueId } });
      expect(venue).not.toBeNull();
    });

    it("should cascade delete votes when participant is deleted", async () => {
      const participantVenueId = uniqueId();

      // Cast a vote
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          venueId: participantVenueId,
          venueData: mockVenueData,
        },
      });

      // Verify vote exists for this participant and venue
      const votesBefore = await db.vote.findMany({
        where: { participantId: testParticipantId, venueId: participantVenueId },
      });
      expect(votesBefore).toHaveLength(1);

      // Delete participant
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      // Verify votes are deleted
      const votesAfter = await db.vote.findMany({
        where: { participantId: testParticipantId, venueId: participantVenueId },
      });
      expect(votesAfter).toHaveLength(0);

      // Verify venue still exists (not deleted with participant)
      const venue = await db.venue.findUnique({ where: { id: participantVenueId } });
      expect(venue).not.toBeNull();
    });
  });
});
