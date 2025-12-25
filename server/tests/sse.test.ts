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
  let testOrganizerToken: string;
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
    testOrganizerToken = eventBody.organizerToken;

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
    it("should reject connection without token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject connection with empty token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream?token=`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject connection with invalid token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/stream?token=invalid_token_12345`,
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
        url: `/api/events/${nonExistentEventId}/stream?token=${testOrganizerToken}`,
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
        url: `/api/events/invalid-id/stream?token=${testOrganizerToken}`,
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
    // 1. Manual test: curl "http://localhost:3000/api/events/{id}/stream?token={token}"
    // 2. Integration test with EventSource in browser or node-eventsource
  });
});
