/**
 * Unit tests for SSE broadcasting in participant operations.
 *
 * Tests verify that participant routes trigger SSE broadcasts with
 * correct payloads when participants are added, updated, or removed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";
import type {
  ParticipantAddedPayload,
  ParticipantUpdatedPayload,
  ParticipantRemovedPayload,
} from "../src/types/sse.js";

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

describe("Participant SSE Broadcasting", () => {
  let server: FastifyInstance;
  let testEventId: string;
  let testParticipantToken: string;
  let broadcastMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the SSE broadcast function
    broadcastMock = vi.fn().mockResolvedValue(undefined);
    server.sse.broadcast = broadcastMock;

    // Create a fresh event for each test
    const response = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "Test Event for SSE Broadcasting",
      },
    });

    const body = response.json();
    testEventId = body.id;
    testParticipantToken = body.participantToken;
  });

  describe("POST /api/events/:id/participants - participant:added broadcast", () => {
    it("should broadcast participant:added when adding a participant", async () => {
      // Arrange
      const participantData = {
        name: "Alice",
        address: "123 Main St, New York, NY",
      };

      // Act
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: `Bearer ${testParticipantToken}`,
        },
        payload: participantData,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const participant = response.json();

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:added",
        payload: expect.objectContaining<ParticipantAddedPayload>({
          participant: {
            id: participant.id,
            name: "Alice",
            address: "123 Main St, New York, NY",
            lat: 40.7128,
            lng: -74.006,
            color: participant.color,
            isOrganizer: false,
          },
        }),
      });
    });

    it("should broadcast participant:added with correct payload structure", async () => {
      // Arrange
      const participantData = {
        name: "Bob",
        address: "456 Oak Ave",
        fuzzyLocation: true,
      };

      // Act
      await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: `Bearer ${testParticipantToken}`,
        },
        payload: participantData,
      });

      // Assert
      expect(broadcastMock).toHaveBeenCalledOnce();
      const broadcastCall = broadcastMock.mock.calls[0][0];

      expect(broadcastCall).toHaveProperty("eventId", testEventId);
      expect(broadcastCall).toHaveProperty("type", "participant:added");
      expect(broadcastCall).toHaveProperty("payload");
      expect(broadcastCall.payload).toHaveProperty("participant");

      const { participant } = broadcastCall.payload as ParticipantAddedPayload;
      expect(participant).toHaveProperty("id");
      expect(participant).toHaveProperty("name", "Bob");
      expect(participant).toHaveProperty("address", "456 Oak Ave");
      expect(participant).toHaveProperty("lat");
      expect(participant).toHaveProperty("lng");
      expect(participant).toHaveProperty("color");
      expect(participant).toHaveProperty("isOrganizer", false);

      // Verify types
      expect(typeof participant.id).toBe("string");
      expect(typeof participant.name).toBe("string");
      expect(typeof participant.address).toBe("string");
      expect(typeof participant.lat).toBe("number");
      expect(typeof participant.lng).toBe("number");
      expect(typeof participant.color).toBe("string");
      expect(typeof participant.isOrganizer).toBe("boolean");
    });

    it("should broadcast for self-registration (no auth)", async () => {
      // Arrange
      const participantData = {
        name: "Charlie",
        address: "789 Pine Rd",
      };

      // Act
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        payload: participantData,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const participant = response.json();

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:added",
        payload: expect.objectContaining<ParticipantAddedPayload>({
          participant: {
            id: participant.id,
            name: "Charlie",
            address: "789 Pine Rd",
            lat: 40.7128,
            lng: -74.006,
            color: participant.color,
            isOrganizer: false,
          },
        }),
      });
    });

    it("should broadcast even when SSE broadcast fails (non-blocking)", async () => {
      // Arrange
      broadcastMock.mockRejectedValueOnce(new Error("Redis connection failed"));
      const participantData = {
        name: "David",
        address: "321 Elm St",
      };

      // Act
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: {
          authorization: `Bearer ${testParticipantToken}`,
        },
        payload: participantData,
      });

      // Assert - participant creation should still succeed
      expect(response.statusCode).toBe(201);
      expect(broadcastMock).toHaveBeenCalledOnce();
    });
  });

  describe("PATCH /api/events/:id/participants/:participantId - participant:updated broadcast", () => {
    let participantId: string;

    beforeEach(async () => {
      // Add a participant to update
      broadcastMock.mockClear(); // Clear the mock from participant creation
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });
      participantId = response.json().id;
      broadcastMock.mockClear(); // Clear again for the actual test
    });

    it("should broadcast participant:updated when updating participant name", async () => {
      // Arrange
      const updateData = {
        name: "Alicia Updated",
      };

      // Act
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const participant = response.json();

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:updated",
        payload: expect.objectContaining<ParticipantUpdatedPayload>({
          participant: {
            id: participantId,
            name: "Alicia Updated",
            address: "123 Main St",
            lat: 40.7128,
            lng: -74.006,
            color: participant.color,
            isOrganizer: false,
          },
        }),
      });
    });

    it("should broadcast participant:updated when updating address", async () => {
      // Arrange
      const updateData = {
        address: "456 New Address Ave",
      };

      // Act
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const participant = response.json();

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:updated",
        payload: expect.objectContaining<ParticipantUpdatedPayload>({
          participant: {
            id: participantId,
            name: "Alice",
            address: "456 New Address Ave",
            lat: 40.7128,
            lng: -74.006,
            color: participant.color,
            isOrganizer: false,
          },
        }),
      });
    });

    it("should broadcast participant:updated with correct payload structure", async () => {
      // Arrange
      const updateData = {
        name: "Updated Name",
        address: "Updated Address",
      };

      // Act
      await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert
      expect(broadcastMock).toHaveBeenCalledOnce();
      const broadcastCall = broadcastMock.mock.calls[0][0];

      expect(broadcastCall).toHaveProperty("eventId", testEventId);
      expect(broadcastCall).toHaveProperty("type", "participant:updated");
      expect(broadcastCall).toHaveProperty("payload");
      expect(broadcastCall.payload).toHaveProperty("participant");

      const { participant } = broadcastCall.payload as ParticipantUpdatedPayload;
      expect(participant).toHaveProperty("id", participantId);
      expect(participant).toHaveProperty("name", "Updated Name");
      expect(participant).toHaveProperty("address", "Updated Address");
      expect(participant).toHaveProperty("lat");
      expect(participant).toHaveProperty("lng");
      expect(participant).toHaveProperty("color");
      expect(participant).toHaveProperty("isOrganizer", false);

      // Verify types
      expect(typeof participant.id).toBe("string");
      expect(typeof participant.name).toBe("string");
      expect(typeof participant.address).toBe("string");
      expect(typeof participant.lat).toBe("number");
      expect(typeof participant.lng).toBe("number");
      expect(typeof participant.color).toBe("string");
      expect(typeof participant.isOrganizer).toBe("boolean");
    });

    it("should broadcast even when SSE broadcast fails (non-blocking)", async () => {
      // Arrange
      broadcastMock.mockRejectedValueOnce(new Error("Redis connection failed"));
      const updateData = {
        name: "Updated Name",
      };

      // Act
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert - update should still succeed
      expect(response.statusCode).toBe(200);
      expect(broadcastMock).toHaveBeenCalledOnce();
    });
  });

  describe("DELETE /api/events/:id/participants/:participantId - participant:removed broadcast", () => {
    let participantId: string;

    beforeEach(async () => {
      // Add a participant to delete
      broadcastMock.mockClear(); // Clear the mock from participant creation
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: {
          name: "Alice",
          address: "123 Main St",
        },
      });
      participantId = response.json().id;
      broadcastMock.mockClear(); // Clear again for the actual test
    });

    it("should broadcast participant:removed when deleting a participant", async () => {
      // Act
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:removed",
        payload: expect.objectContaining<ParticipantRemovedPayload>({
          participantId: participantId,
        }),
      });
    });

    it("should broadcast participant:removed with correct payload structure", async () => {
      // Act
      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Assert
      expect(broadcastMock).toHaveBeenCalledOnce();
      const broadcastCall = broadcastMock.mock.calls[0][0];

      expect(broadcastCall).toHaveProperty("eventId", testEventId);
      expect(broadcastCall).toHaveProperty("type", "participant:removed");
      expect(broadcastCall).toHaveProperty("payload");
      expect(broadcastCall.payload).toHaveProperty("participantId", participantId);

      const { participantId: removedId } = broadcastCall.payload as ParticipantRemovedPayload;
      expect(typeof removedId).toBe("string");
    });

    it("should broadcast even when SSE broadcast fails (non-blocking)", async () => {
      // Arrange
      broadcastMock.mockRejectedValueOnce(new Error("Redis connection failed"));

      // Act
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Assert - deletion should still succeed
      expect(response.statusCode).toBe(200);
      expect(broadcastMock).toHaveBeenCalledOnce();
    });
  });

  describe("Organizer participant updates (isOrganizer: true)", () => {
    let organizerParticipantId: string;

    beforeEach(async () => {
      // Get the organizer participant ID from the event
      broadcastMock.mockClear();
      const eventResponse = await server.inject({
        method: "GET",
        url: `/api/events/${testEventId}`,
      });
      const participants = eventResponse.json().participants;
      const organizerParticipant = participants.find((p: { isOrganizer: boolean }) => p.isOrganizer);
      organizerParticipantId = organizerParticipant.id;
      broadcastMock.mockClear();
    });

    it("should broadcast participant:updated with isOrganizer: true when updating organizer", async () => {
      // Arrange
      const updateData = {
        name: "Updated Organizer Name",
      };

      // Act
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const participant = response.json();

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId: testEventId,
        type: "participant:updated",
        payload: expect.objectContaining<ParticipantUpdatedPayload>({
          participant: expect.objectContaining({
            id: organizerParticipantId,
            name: "Updated Organizer Name",
            isOrganizer: true,
          }),
        }),
      });

      // Verify the broadcast payload has isOrganizer: true
      const broadcastCall = broadcastMock.mock.calls[0][0];
      const { participant: broadcastParticipant } = broadcastCall.payload as ParticipantUpdatedPayload;
      expect(broadcastParticipant.isOrganizer).toBe(true);
    });

    it("should broadcast organizer address update correctly", async () => {
      // Arrange
      const updateData = {
        address: "789 Organizer HQ",
      };

      // Act
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: updateData,
      });

      // Assert
      expect(response.statusCode).toBe(200);

      expect(broadcastMock).toHaveBeenCalledOnce();
      const broadcastCall = broadcastMock.mock.calls[0][0];
      const { participant } = broadcastCall.payload as ParticipantUpdatedPayload;

      expect(participant.id).toBe(organizerParticipantId);
      expect(participant.address).toBe("789 Organizer HQ");
      expect(participant.isOrganizer).toBe(true);
      expect(participant.lat).toBe(40.7128);
      expect(participant.lng).toBe(-74.006);
    });

    it("should not allow deleting organizer participant", async () => {
      // Act
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${organizerParticipantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Assert - deletion should be forbidden
      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");

      // Verify no broadcast was sent for failed deletion
      expect(broadcastMock).not.toHaveBeenCalled();
    });
  });

  describe("Multiple participant operations", () => {
    it("should broadcast multiple participant:added events for multiple additions", async () => {
      // Arrange
      const participants = [
        { name: "Alice", address: "123 Main St" },
        { name: "Bob", address: "456 Oak Ave" },
        { name: "Charlie", address: "789 Pine Rd" },
      ];

      // Act
      for (const participant of participants) {
        await server.inject({
          method: "POST",
          url: `/api/events/${testEventId}/participants`,
          headers: { authorization: `Bearer ${testParticipantToken}` },
          payload: participant,
        });
      }

      // Assert
      expect(broadcastMock).toHaveBeenCalledTimes(3);

      // Verify each broadcast
      participants.forEach((participant, index) => {
        const call = broadcastMock.mock.calls[index][0];
        expect(call.eventId).toBe(testEventId);
        expect(call.type).toBe("participant:added");
        expect(call.payload.participant.name).toBe(participant.name);
        expect(call.payload.participant.address).toBe(participant.address);
      });
    });

    it("should broadcast correct sequence of add, update, and delete", async () => {
      // Arrange - Add a participant
      const addResponse = await server.inject({
        method: "POST",
        url: `/api/events/${testEventId}/participants`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: { name: "TestUser", address: "123 Test St" },
      });
      const participantId = addResponse.json().id;

      broadcastMock.mockClear();

      // Act - Update then delete
      await server.inject({
        method: "PATCH",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
        payload: { name: "TestUser Updated" },
      });

      await server.inject({
        method: "DELETE",
        url: `/api/events/${testEventId}/participants/${participantId}`,
        headers: { authorization: `Bearer ${testParticipantToken}` },
      });

      // Assert
      expect(broadcastMock).toHaveBeenCalledTimes(2);

      // Verify update broadcast
      const updateCall = broadcastMock.mock.calls[0][0];
      expect(updateCall.type).toBe("participant:updated");
      expect(updateCall.payload.participant.id).toBe(participantId);
      expect(updateCall.payload.participant.name).toBe("TestUser Updated");

      // Verify delete broadcast
      const deleteCall = broadcastMock.mock.calls[1][0];
      expect(deleteCall.type).toBe("participant:removed");
      expect(deleteCall.payload.participantId).toBe(participantId);
    });
  });
});
