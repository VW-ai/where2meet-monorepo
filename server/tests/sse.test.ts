/**
 * SSE (Server-Sent Events) endpoint integration tests.
 *
 * Tests the SSE stream endpoint authentication and error handling.
 * Note: Full SSE streaming tests require EventSource client which is
 * complex to mock in Fastify inject. These tests focus on auth/error paths.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

// Mock Geocoding API
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7128,
    lng: -74.006,
    formattedAddress: "123 Test St, New York, NY",
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

describe("SSE Stream Endpoint", () => {
  let server: FastifyInstance;
  let testEventId: string;
  let testOrganizerParticipantToken: string;
  let testParticipantToken: string;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Create a test event
    const eventResponse = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "SSE Test Event",
        meetingTime: "2025-01-15T12:00:00Z",
      },
    });
    const eventBody = eventResponse.json();
    testEventId = eventBody.id;
    testOrganizerParticipantToken = eventBody.participantToken;

    // Create a participant with token (self-registration)
    const participantResponse = await server.inject({
      method: "POST",
      url: `/api/events/${testEventId}/participants`,
      payload: {
        name: "Test Participant",
        address: "123 Test St",
      },
    });
    const participantBody = participantResponse.json();
    testParticipantToken = participantBody.participantToken;
  });

  describe("GET /api/events/:id/stream", () => {
    it("should reject connection without Authorization header", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject connection with empty Bearer token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream`,
        headers: {
          authorization: "Bearer ",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject connection with invalid Authorization format", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream`,
        headers: {
          authorization: "InvalidFormat token123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject connection with invalid token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream`,
        headers: {
          authorization: "Bearer invalid_token_12345",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should reject connection for non-existent event", async () => {
      // Use a valid format event ID that doesn't exist in DB
      const nonExistentEventId = "evt_1702000000000_abcdefghijklmnop";
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${nonExistentEventId}/stream`,
        headers: {
          authorization: `Bearer ${testOrganizerParticipantToken}`,
        },
      });

      // Token is for different event, so we get 403 before 404
      // This is expected behavior - token check happens first
      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should reject connection with invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/invalid-id/stream`,
        headers: {
          authorization: `Bearer ${testOrganizerParticipantToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    // Note: Full SSE streaming tests require manual testing or integration with
    // real HTTP clients. Fastify's inject() waits for response completion, but
    // SSE streams stay open indefinitely. The auth/error tests above verify the
    // endpoint handles authentication correctly.
    //
    // For streaming behavior verification:
    // 1. Manual test: curl -H "Authorization: Bearer {token}" "http://localhost:3000/api/events/{id}/stream"
    // 2. Integration test with EventSource in browser (note: EventSource doesn't support custom headers,
    //    so browser testing requires a polyfill like event-source-polyfill or eventsource package)
  });

  describe("SSE vote:changed event integration", () => {
    let testParticipantId: string;
    const mockVenueData = {
      name: "Test Cafe",
      address: "123 Test St",
      lat: 40.7128,
      lng: -74.006,
      rating: 4.5,
      priceLevel: 2,
      category: "cafe",
      photoUrl: "https://example.com/photo.jpg",
    };

    beforeEach(async () => {
      // Get the organizer participant ID
      const eventData = await server.db.event.findUnique({
        where: { id: testEventId },
        include: { participants: true },
      });
      testParticipantId = eventData!.participants[0].id;
    });

    it("should trigger vote:changed broadcast when casting a vote", async () => {
      const venueId = "ChIJSSE_testVenue_unique123";

      // Spy on SSE broadcast
      const broadcastSpy = vi.spyOn(server.sse, "broadcast");

      // Cast a vote
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      expect(response.statusCode).toBe(201);

      // Allow async broadcast to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify vote:changed event was broadcast
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: testEventId,
          type: "vote:changed",
          payload: expect.objectContaining({
            eventId: testEventId,
            venueId,
            voterId: testParticipantId,
            delta: 1,
            voteCount: 1,
            totalVotes: 1,
          }),
        })
      );

      // Verify vote:statistics event was also broadcast (backward compatibility)
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: testEventId,
          type: "vote:statistics",
          payload: expect.objectContaining({
            eventId: testEventId,
            venues: expect.arrayContaining([
              expect.objectContaining({
                venueId,
                voteCount: 1,
                voterIds: [testParticipantId],
              }),
            ]),
            totalVotes: 1,
          }),
        })
      );

      broadcastSpy.mockRestore();
    });

    it("should trigger vote:changed with delta=-1 when removing a vote", async () => {
      const venueId = "ChIJSSE_testVenue_unique123";

      // First cast a vote
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      // Wait for broadcasts to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Spy on SSE broadcast
      const broadcastSpy = vi.spyOn(server.sse, "broadcast");

      // Remove the vote
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes/${venueId}`,
        headers: { authorization: `Bearer ${testOrganizerParticipantToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Allow async broadcast to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify vote:changed event with delta=-1
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: testEventId,
          type: "vote:changed",
          payload: expect.objectContaining({
            eventId: testEventId,
            venueId,
            voterId: testParticipantId,
            delta: -1,
            voteCount: 0,
            totalVotes: 0,
          }),
        })
      );

      broadcastSpy.mockRestore();
    });

    it("should include seq number and updatedAt in vote:changed payload", async () => {
      const venueId = "ChIJSSE_testVenue_unique123";

      // Spy on SSE broadcast
      const broadcastSpy = vi.spyOn(server.sse, "broadcast");

      // Cast a vote
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      // Allow async broadcast to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the vote:changed broadcast call
      const voteChangedCall = broadcastSpy.mock.calls.find(
        (call) => call[0].type === "vote:changed"
      );

      expect(voteChangedCall).toBeDefined();
      const payload = voteChangedCall![0].payload;

      // Note: seq is set by broadcast() so it will be 0 in the input
      // but enriched during broadcast. We verify the structure exists.
      expect(payload).toHaveProperty("seq");
      expect(payload).toHaveProperty("updatedAt");

      broadcastSpy.mockRestore();
    });

    it("should broadcast both vote:changed and vote:statistics events", async () => {
      const venueId = "ChIJSSE_testVenue_unique123";

      // Spy on SSE broadcast
      const broadcastSpy = vi.spyOn(server.sse, "broadcast");

      // Cast a vote
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants/${testParticipantId}/votes`,
        headers: { authorization: `Bearer ${testOrganizerParticipantToken}` },
        payload: {
          venueId,
          venueData: mockVenueData,
        },
      });

      // Allow async broadcast to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify both event types were broadcast
      const eventTypes = broadcastSpy.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("vote:changed");
      expect(eventTypes).toContain("vote:statistics");

      broadcastSpy.mockRestore();
    });
  });
});
