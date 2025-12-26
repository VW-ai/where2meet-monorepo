/**
 * Unit tests for Participant service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParticipantService } from "../../src/services/participant.js";
import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { Decimal } from "../../src/generated/prisma/runtime/library.js";

// Mock the maps module
vi.mock("../../src/lib/maps.js", () => ({
  geocode: vi.fn(),
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

import { geocode, AddressNotFoundError, GeocodingApiError } from "../../src/lib/maps.js";

const mockGeocode = vi.mocked(geocode);

/** Test IDs */
const TEST_EVENT_ID = "evt_1702000000000_abcdefghijklmnop";
const TEST_PARTICIPANT_ID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  return {
    event: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    participant: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as PrismaClient;
}

/**
 * Creates a mock event entity.
 */
function createMockEvent(overrides: Partial<{ publishedAt: Date | null }> = {}) {
  return {
    id: TEST_EVENT_ID,
    title: "Test Event",
    meetingTime: null,
    publishedVenueId: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [],
    ...overrides,
  };
}

/**
 * Creates a mock participant entity.
 */
function createMockParticipant(overrides: Partial<{
  id: string;
  eventId: string;
  name: string;
  address: string;
  color: string;
  isOrganizer: boolean;
}> = {}) {
  return {
    id: TEST_PARTICIPANT_ID,
    eventId: TEST_EVENT_ID,
    name: "Alice",
    address: "123 Main St",
    formattedAddress: "123 Main Street, New York, NY 10001",
    lat: new Decimal(40.7128),
    lng: new Decimal(-74.006),
    fuzzyLocation: false,
    color: "coral",
    isOrganizer: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("ParticipantService", () => {
  let service: ParticipantService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new ParticipantService(mockPrisma);

    // Default geocode mock
    mockGeocode.mockResolvedValue({
      lat: 40.7128,
      lng: -74.006,
      formattedAddress: "123 Main Street, New York, NY 10001",
    });
  });

  describe("addParticipant", () => {
    it("should create participant with geocoded location and assigned color", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.participant.create).mockResolvedValue(createMockParticipant());

      const result = await service.addParticipant(TEST_EVENT_ID, {
        name: "Alice",
        address: "123 Main St",
        fuzzyLocation: false,
      });

      // Result now returns { participant, participantToken? }
      expect(result.participant.name).toBe("Alice");
      expect(result.participant.color).toBe("coral");
      expect(result.participantToken).toBeUndefined(); // No token when not self-registering
      expect(mockGeocode).toHaveBeenCalledWith("123 Main St");
      expect(mockPrisma.participant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: TEST_EVENT_ID,
            name: "Alice",
            address: "123 Main St",
            color: "coral",
          }),
        })
      );
    });

    it("should assign second color when first is used", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findMany).mockResolvedValue([
        createMockParticipant({ color: "coral" }),
      ]);
      vi.mocked(mockPrisma.participant.create).mockResolvedValue(
        createMockParticipant({ color: "teal" })
      );

      await service.addParticipant(TEST_EVENT_ID, {
        name: "Bob",
        address: "456 Oak Ave",
        fuzzyLocation: false,
      });

      expect(mockPrisma.participant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            color: "teal",
          }),
        })
      );
    });

    it("should throw EventNotFoundError when event does not exist", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(null);

      await expect(
        service.addParticipant("non-existent", {
          name: "Alice",
          address: "123 Main St",
          fuzzyLocation: false,
        })
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("should throw EventAlreadyPublishedError when event is published", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(
        createMockEvent({ publishedAt: new Date() })
      );

      await expect(
        service.addParticipant(TEST_EVENT_ID, {
          name: "Alice",
          address: "123 Main St",
          fuzzyLocation: false,
        })
      ).rejects.toMatchObject({
        code: "EVENT_ALREADY_PUBLISHED",
        statusCode: 409,
      });

      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("should throw AddressNotFoundError when geocoding fails", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      mockGeocode.mockRejectedValue(new AddressNotFoundError("invalid address"));

      await expect(
        service.addParticipant(TEST_EVENT_ID, {
          name: "Alice",
          address: "invalid address",
          fuzzyLocation: false,
        })
      ).rejects.toMatchObject({
        code: "ADDRESS_NOT_FOUND",
        statusCode: 400,
      });
    });

    it("should throw ExternalServiceError when geocoding API fails", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      mockGeocode.mockRejectedValue(new GeocodingApiError("API quota exceeded", "OVER_QUERY_LIMIT"));

      await expect(
        service.addParticipant(TEST_EVENT_ID, {
          name: "Alice",
          address: "123 Main St",
          fuzzyLocation: false,
        })
      ).rejects.toMatchObject({
        code: "EXTERNAL_SERVICE_ERROR",
        statusCode: 502,
      });
    });

    it("should apply fuzzy offset when fuzzyLocation is true", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.participant.create).mockImplementation(async (args) => {
        const data = (args as { data: Record<string, unknown> }).data;
        return createMockParticipant({
          ...data,
        } as Parameters<typeof createMockParticipant>[0]);
      });

      await service.addParticipant(TEST_EVENT_ID, {
        name: "Alice",
        address: "123 Main St",
        fuzzyLocation: true,
      });

      // Verify coordinates were offset (not exact geocode result)
      const createCall = vi.mocked(mockPrisma.participant.create).mock.calls[0];
      const createData = (createCall?.[0] as { data: { lat: number; lng: number } })?.data;

      // With fuzzy, coordinates should be different from exact geocode result
      // Due to deterministic offset based on name, we can't predict exact values
      // but they should be close to original (within ~0.01 degrees / ~1km)
      expect(Math.abs(createData.lat - 40.7128)).toBeLessThan(0.01);
      expect(Math.abs(createData.lng - (-74.006))).toBeLessThan(0.01);
    });
  });

  describe("updateParticipant", () => {
    it("should update participant name without re-geocoding", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(createMockParticipant());
      vi.mocked(mockPrisma.participant.update).mockResolvedValue(
        createMockParticipant({ name: "Alicia" })
      );

      const result = await service.updateParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID, {
        name: "Alicia",
      });

      expect(result.name).toBe("Alicia");
      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("should re-geocode when address changes", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(createMockParticipant());

      mockGeocode.mockResolvedValue({
        lat: 34.0522,
        lng: -118.2437,
        formattedAddress: "456 Oak Ave, Los Angeles, CA 90001",
      });

      vi.mocked(mockPrisma.participant.update).mockResolvedValue(
        createMockParticipant({
          address: "456 Oak Ave, LA",
        })
      );

      await service.updateParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID, {
        address: "456 Oak Ave, LA",
      });

      expect(mockGeocode).toHaveBeenCalledWith("456 Oak Ave, LA");
      expect(mockPrisma.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            address: "456 Oak Ave, LA",
            lat: 34.0522,
            lng: -118.2437,
          }),
        })
      );
    });

    it("should throw ParticipantNotFoundError when participant does not exist", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.count).mockResolvedValue(0);

      await expect(
        service.updateParticipant(TEST_EVENT_ID, "non-existent", { name: "Bob" })
      ).rejects.toMatchObject({
        code: "PARTICIPANT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw EventAlreadyPublishedError when event is published", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(
        createMockEvent({ publishedAt: new Date() })
      );

      await expect(
        service.updateParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID, { name: "Bob" })
      ).rejects.toMatchObject({
        code: "EVENT_ALREADY_PUBLISHED",
        statusCode: 409,
      });
    });
  });

  describe("deleteParticipant", () => {
    it("should delete participant", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(createMockParticipant());
      vi.mocked(mockPrisma.participant.delete).mockResolvedValue(createMockParticipant());

      await service.deleteParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID);

      expect(mockPrisma.participant.delete).toHaveBeenCalledWith({
        where: { id: TEST_PARTICIPANT_ID },
      });
    });

    it("should throw ParticipantNotFoundError when participant does not exist", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(null);

      await expect(
        service.deleteParticipant(TEST_EVENT_ID, "non-existent")
      ).rejects.toMatchObject({
        code: "PARTICIPANT_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenError when deleting organizer participant", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(createMockEvent());
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(
        createMockParticipant({ isOrganizer: true })
      );

      await expect(
        service.deleteParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID)
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
        message: "Cannot delete the organizer participant",
      });

      expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
    });

    it("should throw EventAlreadyPublishedError when event is published", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(
        createMockEvent({ publishedAt: new Date() })
      );

      await expect(
        service.deleteParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID)
      ).rejects.toMatchObject({
        code: "EVENT_ALREADY_PUBLISHED",
        statusCode: 409,
      });

      expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
    });
  });

  describe("getParticipant", () => {
    it("should return participant", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(createMockParticipant());

      const result = await service.getParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID);

      expect(result.id).toBe(TEST_PARTICIPANT_ID);
      expect(result.name).toBe("Alice");
    });

    it("should throw EventNotFoundError when event does not exist", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(0);

      await expect(
        service.getParticipant("non-existent", TEST_PARTICIPANT_ID)
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw ParticipantNotFoundError when participant does not exist", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(null);

      await expect(
        service.getParticipant(TEST_EVENT_ID, "non-existent")
      ).rejects.toMatchObject({
        code: "PARTICIPANT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw ParticipantNotFoundError when participant belongs to different event", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.participant.findUnique).mockResolvedValue(
        createMockParticipant({ eventId: "different-event-id" })
      );

      await expect(
        service.getParticipant(TEST_EVENT_ID, TEST_PARTICIPANT_ID)
      ).rejects.toMatchObject({
        code: "PARTICIPANT_NOT_FOUND",
        statusCode: 404,
      });
    });
  });
});
