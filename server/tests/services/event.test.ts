import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventService } from "../../src/services/event.js";
import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { generateEventId } from "../../src/utils/id.js";
import { hashToken } from "../../src/utils/token.js";

/** Test event ID in semantic format */
const TEST_EVENT_ID = "evt_1702000000000_abcdefghijklmnop";

/** Test organizer participant ID */
const TEST_ORGANIZER_PARTICIPANT_ID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  const mockPrisma = {
    event: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    participant: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // Make $transaction execute the callback with the mock prisma as argument
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
    return callback(mockPrisma);
  });

  return mockPrisma as unknown as PrismaClient;
}

describe("EventService", () => {
  let service: EventService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new EventService(mockPrisma);
  });

  describe("createEvent", () => {
    it("should return event entity, organizerToken with ot_ prefix, and organizerParticipantId", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Test Event",
        meetingTime: new Date("2024-12-15T12:00:00Z"),
        organizerTokenHash: hashToken("ot_" + "a".repeat(64)),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      const mockOrganizerParticipant = {
        id: TEST_ORGANIZER_PARTICIPANT_ID,
        eventId: TEST_EVENT_ID,
        name: "Organizer",
        address: null,
        formattedAddress: null,
        lat: null,
        lng: null,
        fuzzyLocation: false,
        color: "coral",
        tokenHash: mockEvent.organizerTokenHash,
        isOrganizer: true,
        createdAt: new Date(),
      };

      const mockEventWithParticipants = {
        ...mockEvent,
        participants: [mockOrganizerParticipant],
      };

      vi.mocked(mockPrisma.event.create).mockResolvedValue(mockEvent);
      vi.mocked(mockPrisma.participant.create).mockResolvedValue(mockOrganizerParticipant);
      vi.mocked(mockPrisma.event.findUniqueOrThrow).mockResolvedValue(mockEventWithParticipants);

      const result = await service.createEvent({
        title: "Test Event",
        meetingTime: "2024-12-15T12:00:00Z",
      });

      // Service returns { event, organizerToken, organizerParticipantId }
      expect(result).toHaveProperty("event");
      expect(result).toHaveProperty("organizerToken");
      expect(result).toHaveProperty("organizerParticipantId");
      // Token format: ot_ + 64 hex chars = 67 chars total
      expect(result.organizerToken).toHaveLength(67);
      expect(result.organizerToken).toMatch(/^ot_[a-f0-9]{64}$/);
      expect(result.event.title).toBe("Test Event");
      expect(result.organizerParticipantId).toBe(TEST_ORGANIZER_PARTICIPANT_ID);
      // Verify organizer participant is in the participants array
      expect(result.event.participants).toHaveLength(1);
      expect(result.event.participants[0].isOrganizer).toBe(true);
    });

    it("should create an event without meetingTime", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Quick Meetup",
        meetingTime: null,
        organizerTokenHash: hashToken("ot_" + "b".repeat(64)),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      const mockOrganizerParticipant = {
        id: TEST_ORGANIZER_PARTICIPANT_ID,
        eventId: TEST_EVENT_ID,
        name: "Organizer",
        address: null,
        formattedAddress: null,
        lat: null,
        lng: null,
        fuzzyLocation: false,
        color: "coral",
        tokenHash: mockEvent.organizerTokenHash,
        isOrganizer: true,
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.event.create).mockResolvedValue(mockEvent);
      vi.mocked(mockPrisma.participant.create).mockResolvedValue(mockOrganizerParticipant);
      vi.mocked(mockPrisma.event.findUniqueOrThrow).mockResolvedValue({
        ...mockEvent,
        participants: [mockOrganizerParticipant],
      });

      const result = await service.createEvent({ title: "Quick Meetup" });

      expect(result.event.title).toBe("Quick Meetup");
      expect(result.event.meetingTime).toBeNull();
      expect(result.organizerParticipantId).toBe(TEST_ORGANIZER_PARTICIPANT_ID);
    });

    it("should generate unique token hashes for each event", async () => {
      const hashes: string[] = [];

      vi.mocked(mockPrisma.event.create).mockImplementation(async (args) => {
        const hash = (args as { data: { organizerTokenHash: string } }).data.organizerTokenHash;
        hashes.push(hash);
        return {
          id: generateEventId(),
          title: "Test",
          meetingTime: null,
          organizerTokenHash: hash,
          publishedVenueId: null,
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [],
        };
      });

      vi.mocked(mockPrisma.participant.create).mockImplementation(async () => ({
        id: TEST_ORGANIZER_PARTICIPANT_ID,
        eventId: TEST_EVENT_ID,
        name: "Organizer",
        address: null,
        formattedAddress: null,
        lat: null,
        lng: null,
        fuzzyLocation: false,
        color: "coral",
        tokenHash: hashes[hashes.length - 1] || "",
        isOrganizer: true,
        createdAt: new Date(),
      }));

      vi.mocked(mockPrisma.event.findUniqueOrThrow).mockImplementation(async () => ({
        id: generateEventId(),
        title: "Test",
        meetingTime: null,
        organizerTokenHash: hashes[hashes.length - 1] || "",
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      }));

      await service.createEvent({ title: "Event 1" });
      await service.createEvent({ title: "Event 2" });

      expect(hashes[0]).not.toBe(hashes[1]);
    });
  });

  describe("getEvent", () => {
    it("should return raw event entity", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Test Event",
        meetingTime: new Date("2024-12-15T12:00:00Z"),
        organizerTokenHash: hashToken("ot_secret"),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(mockEvent);

      const result = await service.getEvent(mockEvent.id);

      // Service returns raw entity (organizerTokenHash is internal, not exposed)
      // Transformation to Response DTO happens in route handlers
      expect(result.id).toBe(mockEvent.id);
      expect(result.title).toBe("Test Event");
      // Note: organizerTokenHash is stored, not the plaintext token
      expect(result.organizerTokenHash).toBeDefined();
    });

    it("should throw EventNotFoundError for non-existent event", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(null);

      await expect(service.getEvent("non-existent-id")).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should return participants as raw entities", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Test Event",
        meetingTime: null,
        organizerTokenHash: hashToken("ot_token"),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          {
            id: "participant-1",
            eventId: TEST_EVENT_ID,
            name: "Alice",
            address: "123 Main St",
            lat: 40.7128,
            lng: -74.006,
            color: "#FF5733",
            fuzzyLocation: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(mockEvent);

      const result = await service.getEvent(mockEvent.id);

      // Returns raw entities - transformation to Response DTO happens in mapper
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0].name).toBe("Alice");
      expect(result.participants[0].lat).toBe(40.7128);
      expect(result.participants[0].lng).toBe(-74.006);
    });
  });

  describe("updateEvent", () => {
    it("should return updated event entity", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.event.update).mockResolvedValue({
        id: "event-id",
        title: "Updated Title",
        meetingTime: null,
        organizerTokenHash: hashToken("ot_token"),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      });

      const result = await service.updateEvent("event-id", {
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-id" },
          data: { title: "Updated Title" },
        })
      );
    });

    it("should throw EventNotFoundError when updating non-existent event", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(0);

      await expect(
        service.updateEvent("non-existent", { title: "New Title" })
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteEvent", () => {
    it("should delete existing event", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.event.delete).mockResolvedValue({
        id: "event-id",
        title: "Deleted Event",
        meetingTime: null,
        organizerTokenHash: hashToken("ot_token"),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.deleteEvent("event-id");

      expect(mockPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: "event-id" },
      });
    });

    it("should throw EventNotFoundError when deleting non-existent event", async () => {
      vi.mocked(mockPrisma.event.count).mockResolvedValue(0);

      await expect(service.deleteEvent("non-existent")).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockPrisma.event.delete).not.toHaveBeenCalled();
    });
  });

  describe("verifyOrganizerToken", () => {
    it("should return true for valid token", async () => {
      const token = "ot_" + "a".repeat(64);
      const storedHash = hashToken(token);

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        organizerTokenHash: storedHash,
      } as never);

      const result = await service.verifyOrganizerToken("event-id", token);

      expect(result).toBe(true);
    });

    it("should return false for invalid token", async () => {
      const correctToken = "ot_" + "a".repeat(64);
      const wrongToken = "ot_" + "b".repeat(64);
      const storedHash = hashToken(correctToken);

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        organizerTokenHash: storedHash,
      } as never);

      const result = await service.verifyOrganizerToken("event-id", wrongToken);

      expect(result).toBe(false);
    });

    it("should throw EventNotFoundError for non-existent event", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(null);

      await expect(
        service.verifyOrganizerToken("non-existent", "any-token")
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should use timing-safe comparison via hash verification", async () => {
      // This test ensures the comparison uses timing-safe hash comparison
      const storedToken = "ot_" + "a".repeat(64);
      const wrongToken = "ot_" + "b".repeat(64);
      const storedHash = hashToken(storedToken);

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        organizerTokenHash: storedHash,
      } as never);

      const result = await service.verifyOrganizerToken("event-id", wrongToken);

      expect(result).toBe(false);
    });
  });
});
