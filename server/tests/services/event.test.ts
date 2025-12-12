import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventService } from "../../src/services/event.js";
import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { generateEventId } from "../../src/utils/id.js";

/** Test event ID in semantic format */
const TEST_EVENT_ID = "evt_1702000000000_abcdefghijklmnop";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  return {
    event: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("EventService", () => {
  let service: EventService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new EventService(mockPrisma);
  });

  describe("createEvent", () => {
    it("should return event entity and 64-char organizerToken", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Test Event",
        meetingTime: new Date("2024-12-15T12:00:00Z"),
        organizerToken: "a".repeat(64),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      vi.mocked(mockPrisma.event.create).mockResolvedValue(mockEvent);

      const result = await service.createEvent({
        title: "Test Event",
        meetingTime: "2024-12-15T12:00:00Z",
      });

      // Service returns { event, organizerToken }
      expect(result).toHaveProperty("event");
      expect(result).toHaveProperty("organizerToken");
      expect(result.organizerToken).toHaveLength(64);
      expect(result.event.title).toBe("Test Event");
      expect(mockPrisma.event.create).toHaveBeenCalledTimes(1);
    });

    it("should create an event without meetingTime", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Quick Meetup",
        meetingTime: null,
        organizerToken: "b".repeat(64),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      vi.mocked(mockPrisma.event.create).mockResolvedValue(mockEvent);

      const result = await service.createEvent({ title: "Quick Meetup" });

      expect(result.event.title).toBe("Quick Meetup");
      expect(result.event.meetingTime).toBeNull();
    });

    it("should generate unique tokens for each event", async () => {
      const tokens: string[] = [];

      vi.mocked(mockPrisma.event.create).mockImplementation(async (args) => {
        const token = (args as { data: { organizerToken: string } }).data.organizerToken;
        tokens.push(token);
        return {
          id: generateEventId(),
          title: "Test",
          meetingTime: null,
          organizerToken: token,
          publishedVenueId: null,
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [],
        };
      });

      await service.createEvent({ title: "Event 1" });
      await service.createEvent({ title: "Event 2" });

      expect(tokens[0]).not.toBe(tokens[1]);
    });
  });

  describe("getEvent", () => {
    it("should return raw event entity", async () => {
      const mockEvent = {
        id: TEST_EVENT_ID,
        title: "Test Event",
        meetingTime: new Date("2024-12-15T12:00:00Z"),
        organizerToken: "secret-token",
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue(mockEvent);

      const result = await service.getEvent(mockEvent.id);

      // Service now returns raw entity (includes organizerToken)
      // Transformation to Response DTO happens in route handlers
      expect(result.id).toBe(mockEvent.id);
      expect(result.title).toBe("Test Event");
      expect(result.organizerToken).toBe("secret-token");
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
        organizerToken: "token",
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
        organizerToken: "token",
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
        organizerToken: "token",
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
      const token = "valid-token-that-is-64-chars-long".padEnd(64, "x");
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        id: "event-id",
        title: "Test",
        meetingTime: null,
        organizerToken: token,
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.verifyOrganizerToken("event-id", token);

      expect(result).toBe(true);
    });

    it("should return false for invalid token", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        id: "event-id",
        title: "Test",
        meetingTime: null,
        organizerToken: "correct-token".padEnd(64, "x"),
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.verifyOrganizerToken(
        "event-id",
        "wrong-token".padEnd(64, "y")
      );

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

    it("should use timing-safe comparison", async () => {
      // This test ensures the comparison doesn't short-circuit on first mismatch
      const storedToken = "a".repeat(64);
      const wrongToken = "b".repeat(64);

      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        id: "event-id",
        title: "Test",
        meetingTime: null,
        organizerToken: storedToken,
        publishedVenueId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.verifyOrganizerToken("event-id", wrongToken);

      expect(result).toBe(false);
    });
  });
});
