import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

// Mock Geocoding API for participant creation in MEC tests
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockImplementation((address: string) => {
    // Return mock coordinates based on address
    if (address.includes("123 Main St")) {
      return Promise.resolve({
        lat: 40.7484,
        lng: -73.9857,
        formattedAddress: "123 Main St, New York, NY 10001, USA",
      });
    }
    if (address.includes("456 Oak Ave")) {
      return Promise.resolve({
        lat: 40.7127,
        lng: -74.0134,
        formattedAddress: "456 Oak Ave, New York, NY 10002, USA",
      });
    }
    if (address.includes("789 Broadway")) {
      return Promise.resolve({
        lat: 40.7589,
        lng: -73.9851,
        formattedAddress: "789 Broadway, New York, NY 10003, USA",
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

describe("Event Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("POST /api/events", () => {
    it("should create an event with valid data", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Team Lunch",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("title", "Team Lunch");
      expect(body).toHaveProperty("meetingTime", "2024-12-15T12:00:00.000Z");
      expect(body).toHaveProperty("participantToken");
      // Token format: pt_ + 64 hex chars = 67 chars total
      expect(body.participantToken).toHaveLength(67);
      expect(body.participantToken).toMatch(/^pt_[a-f0-9]{64}$/);
      // Auto-created organizer participant
      expect(body).toHaveProperty("organizerParticipantId");
      expect(body).toHaveProperty("participants");
      expect(body.participants).toHaveLength(1);
      expect(body.participants[0].isOrganizer).toBe(true);
      expect(body.participants[0].name).toBe("Organizer");
      expect(body.participants[0].location).toBeNull();
    });

    it("should create an event without meetingTime", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Quick Meetup",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("title", "Quick Meetup");
      expect(body.meetingTime).toBeNull();
    });

    it("should return 400 for missing title", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should return 400 for empty title", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for title exceeding max length", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "A".repeat(101),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid datetime format", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Test Event",
          meetingTime: "not-a-date",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/events/:id", () => {
    let createdEventId: string;
    let participantToken: string;

    beforeEach(async () => {
      // Create a fresh event for each test
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Test Event",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      participantToken = created.participantToken;
    });

    it("should get an existing event", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("id", createdEventId);
      expect(body).toHaveProperty("title", "Test Event");
      // participantToken should NOT be in the response (only returned at creation)
      expect(body).not.toHaveProperty("participantToken");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/evt_1702000000000_nonexistent12345",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-event-id",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PATCH /api/events/:id", () => {
    let createdEventId: string;
    let participantToken: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Original Title",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      participantToken = created.participantToken;
    });

    it("should update event with valid token", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe("Updated Title");
    });

    it("should update meetingTime", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
        payload: {
          meetingTime: "2024-12-20T18:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.meetingTime).toBe("2024-12-20T18:00:00.000Z");
    });

    it("should clear meetingTime with null", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
        payload: {
          meetingTime: null,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.meetingTime).toBeNull();
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: "Bearer invalid-token-that-is-definitely-wrong",
        },
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/events/evt_1702000000000_nonexistent12345",
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 400 for empty update body", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/events/:id/mec", () => {
    let createdEventId: string;
    let participantToken: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "MEC Test Event",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      participantToken = created.participantToken;
    });

    it("should return null center/radius when only organizer exists (no locations)", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}/mec`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.center).toBeNull();
      expect(body.radiusMeters).toBeNull();
    });

    it("should return single point with radius 0 for one participant", async () => {
      // Add one participant with location
      await server.inject({
        method: "POST",
        url: `/api/events/${createdEventId}/participants`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St, New York, NY",
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}/mec`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.center).not.toBeNull();
      expect(body.center).toHaveProperty("lat");
      expect(body.center).toHaveProperty("lng");
      expect(body.radiusMeters).toBe(0);
    });

    it("should return midpoint for two participants", async () => {
      // Add two participants with locations
      await server.inject({
        method: "POST",
        url: `/api/events/${createdEventId}/participants`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St, New York, NY",
        },
      });

      await server.inject({
        method: "POST",
        url: `/api/events/${createdEventId}/participants`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: {
          name: "Bob",
          address: "456 Oak Ave, New York, NY",
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}/mec`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.center).not.toBeNull();
      expect(body.center).toHaveProperty("lat");
      expect(body.center).toHaveProperty("lng");
      expect(body.radiusMeters).toBeGreaterThan(0);
    });

    it("should include organizer in MEC after they add their location", async () => {
      // Add one participant with location first
      await server.inject({
        method: "POST",
        url: `/api/events/${createdEventId}/participants`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: { name: "Alice", address: "123 Main St, New York, NY" },
      });

      // Get initial MEC (just Alice)
      const initialMec = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}/mec`,
      });
      const initialCenter = initialMec.json().center;
      expect(initialCenter).not.toBeNull();

      // Get organizer's participant ID
      const eventResponse = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}`,
      });
      const organizerPid = eventResponse.json().participants.find(
        (p: { isOrganizer: boolean }) => p.isOrganizer
      ).id;

      // Organizer updates their own location
      await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}/participants/${organizerPid}`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: { address: "789 Broadway, New York, NY" },
      });

      // Get updated MEC (now includes organizer)
      const updatedMec = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}/mec`,
      });
      const updatedBody = updatedMec.json();

      expect(updatedBody.center).not.toBeNull();
      // With two points, radius should be > 0 (distance between them)
      expect(updatedBody.radiusMeters).toBeGreaterThan(0);
      // Center should have shifted (now midpoint of Alice + Organizer)
      // We can't assert exact values due to mocked geocoding, but center should exist
      expect(updatedBody.center).toHaveProperty("lat");
      expect(updatedBody.center).toHaveProperty("lng");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/evt_1702000000000_nonexistent12345/mec",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-event-id/mec",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/events/:id/me", () => {
    let testEventId: string;
    let testOrganizerToken: string;
    let organizerParticipantId: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Test Event for /me",
        },
      });
      const created = createResponse.json();
      testEventId = created.id;
      testOrganizerToken = created.participantToken;
      organizerParticipantId = created.organizerParticipantId;
    });

    it("should return organizer info with isOrganizer=true", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/me`,
        headers: {
          authorization: `Bearer ${testOrganizerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.participantId).toBe(organizerParticipantId);
      expect(body.name).toBe("Organizer");
      expect(body.isOrganizer).toBe(true);
      expect(body.color).toBeDefined();
      expect(body.address).toBeNull();
      expect(body.lat).toBeNull();
      expect(body.lng).toBeNull();
    });

    it("should return participant info with isOrganizer=false", async () => {
      // Self-register a participant
      const registerResponse = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "RegularUser",
          address: "123 Main St",
        },
      });
      expect(registerResponse.statusCode).toBe(201);
      const participant = registerResponse.json();

      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/me`,
        headers: {
          authorization: `Bearer ${participant.participantToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.participantId).toBe(participant.id);
      expect(body.name).toBe("RegularUser");
      expect(body.isOrganizer).toBe(false);
      expect(body.color).toBeDefined();
      expect(body.address).toBeDefined();
      expect(body.lat).toBeDefined();
      expect(body.lng).toBeDefined();
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/me`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}/me`,
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 for invalid event ID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-id/me",
        headers: {
          authorization: `Bearer ${testOrganizerToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /api/events/:id", () => {
    let createdEventId: string;
    let participantToken: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Event to Delete",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      participantToken = created.participantToken;
    });

    it("should delete event with valid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Event deleted successfully");

      // Verify event is actually deleted
      const getResponse = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: "Bearer wrong-token",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: "/api/events/evt_1702000000000_nonexistent12345",
        headers: {
          authorization: `Bearer ${participantToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
