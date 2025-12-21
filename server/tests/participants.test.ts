/**
 * Integration tests for Participant endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

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

import { geocode, AddressNotFoundError } from "../src/lib/maps.js";

const mockGeocode = vi.mocked(geocode);

describe("Participant Endpoints", () => {
  let server: FastifyInstance;
  let testEventId: string;
  let testOrganizerToken: string;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset geocode mock to default behavior
    mockGeocode.mockResolvedValue({
      lat: 40.7128,
      lng: -74.006,
      formattedAddress: "123 Main Street, New York, NY 10001",
    });

    // Create a fresh event for each test
    const response = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "Test Event for Participants",
      },
    });

    const body = response.json();
    testEventId = body.id;
    testOrganizerToken = body.organizerToken;
  });

  describe("POST /api/events/:id/participants", () => {
    it("should add a participant with valid data", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: `Bearer ${testOrganizerToken}`,
        },
        payload: {
          name: "Alice",
          address: "123 Main St, New York, NY",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("name", "Alice");
      expect(body).toHaveProperty("address", "123 Main St, New York, NY");
      expect(body).toHaveProperty("location");
      expect(body.location).toHaveProperty("lat", 40.7128);
      expect(body.location).toHaveProperty("lng", -74.006);
      // Note: organizer participant gets "coral", so first added participant gets "teal"
      expect(body).toHaveProperty("color", "teal");
      expect(body).toHaveProperty("fuzzyLocation", false);
    });

    it("should add participant with fuzzyLocation", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: `Bearer ${testOrganizerToken}`,
        },
        payload: {
          name: "Bob",
          address: "456 Oak Ave",
          fuzzyLocation: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.fuzzyLocation).toBe(true);
      // Location should be offset from exact geocode result
      // Can't predict exact values due to hash-based offset
    });

    it("should assign different colors to multiple participants", async () => {
      // Add first participant
      const response1 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: { name: "Alice", address: "123 Main St" },
      });

      // Add second participant
      const response2 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: { name: "Bob", address: "456 Oak Ave" },
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);

      const body1 = response1.json();
      const body2 = response2.json();

      // Note: organizer participant gets "coral", so colors shift by 1
      expect(body1.color).toBe("teal");
      expect(body2.color).toBe("gold");
    });

    it("should allow self-registration without auth and return participantToken", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe("Alice");
      // Self-registration returns participantToken for self-management
      expect(body).toHaveProperty("participantToken");
      expect(body.participantToken).toMatch(/^pt_[a-f0-9]{64}$/);
    });

    it("should return 403 with invalid organizer token", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: "Bearer invalid-token",
        },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 for missing name", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          address: "123 Main St",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for missing address", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alice",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for address not found", async () => {
      mockGeocode.mockRejectedValue(new AddressNotFoundError("invalid address xyz"));

      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alice",
          address: "invalid address xyz",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("ADDRESS_NOT_FOUND");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events/evt_1702000000000_nonexistent12345/participants",
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });
  });

  describe("PATCH /api/events/:id/participants/:participantId", () => {
    let participantId: string;

    beforeEach(async () => {
      // Add a participant to update
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });
      participantId = response.json().id;
    });

    it("should update participant name", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alicia",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe("Alicia");
      expect(body.address).toBe("123 Main St"); // Unchanged
    });

    it("should update participant address and re-geocode", async () => {
      mockGeocode.mockResolvedValue({
        lat: 34.0522,
        lng: -118.2437,
        formattedAddress: "456 Oak Ave, Los Angeles, CA 90001",
      });

      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          address: "456 Oak Ave, Los Angeles",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.address).toBe("456 Oak Ave, Los Angeles");
      expect(body.location.lat).toBe(34.0522);
      expect(body.location.lng).toBe(-118.2437);
    });

    it("should return 401 without organizer token", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        payload: { name: "Bob" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for non-existent participant", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/550e8400-e29b-41d4-a716-446655440000`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: { name: "Bob" },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("PARTICIPANT_NOT_FOUND");
    });

    it("should return 400 for empty update", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/events/:id/participants/:participantId", () => {
    let participantId: string;

    beforeEach(async () => {
      // Add a participant to delete
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });
      participantId = response.json().id;
    });

    it("should delete participant", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe("Participant deleted successfully");

      // Verify participant is gone by checking event
      // Note: organizer participant still exists
      const eventResponse = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}`,
      });
      const participants = eventResponse.json().participants;
      expect(participants).toHaveLength(1);
      expect(participants[0].isOrganizer).toBe(true);
    });

    it("should return 401 without organizer token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for non-existent participant", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/550e8400-e29b-41d4-a716-446655440000`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("PARTICIPANT_NOT_FOUND");
    });
  });

  describe("Self-management with participantToken", () => {
    let participantId: string;
    let participantToken: string;
    let otherParticipantId: string;

    beforeEach(async () => {
      // Self-register a participant (no auth = self-registration)
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: {
          name: "SelfJoiner",
          address: "123 Main St",
        },
      });
      const body = response.json();
      participantId = body.id;
      participantToken = body.participantToken;

      // Create another participant via organizer
      const response2 = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "OtherParticipant",
          address: "456 Oak Ave",
        },
      });
      otherParticipantId = response2.json().id;
    });

    it("should allow participant to update themselves with participantToken", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: { name: "UpdatedName" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe("UpdatedName");
    });

    it("should allow participant to delete themselves with participantToken", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${participantToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toBe("Participant deleted successfully");
    });

    it("should not allow participant to update others with participantToken", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${otherParticipantId}`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: { name: "Hacked" },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should not allow participant to delete others with participantToken", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${otherParticipantId}`,
        headers: { authorization: `Bearer ${participantToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should not return participantToken when organizer adds participant", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testOrganizerToken}` },
        payload: {
          name: "OrganizerAdded",
          address: "789 Pine Rd",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe("OrganizerAdded");
      expect(body.participantToken).toBeUndefined();
    });
  });
});
