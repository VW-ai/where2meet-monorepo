/**
 * Unit tests for Vote repository.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoteRepository } from "../../src/repositories/vote.js";
import type { PrismaClient, Vote, Venue } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/** Test IDs */
const TEST_EVENT_ID = "evt_1702000000000_abcdefghijklmnop";
const TEST_PARTICIPANT_ID_1 = "550e8400-e29b-41d4-a716-446655440001";
const TEST_PARTICIPANT_ID_2 = "550e8400-e29b-41d4-a716-446655440002";
const TEST_VENUE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const TEST_VOTE_ID = "660e8400-e29b-41d4-a716-446655440000";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  return {
    vote: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

/**
 * Creates a mock venue entity.
 */
function createMockVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: TEST_VENUE_ID,
    name: "Test Venue",
    address: "123 Test St",
    lat: new Decimal(40.7128),
    lng: new Decimal(-74.006),
    category: "restaurant",
    rating: new Decimal(4.5),
    priceLevel: 2,
    photoUrl: "https://example.com/photo.jpg",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

/**
 * Creates a mock vote entity.
 */
function createMockVote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: TEST_VOTE_ID,
    eventId: TEST_EVENT_ID,
    participantId: TEST_PARTICIPANT_ID_1,
    venueId: TEST_VENUE_ID,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("VoteRepository", () => {
  let mockPrisma: PrismaClient;
  let repository: VoteRepository;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repository = new VoteRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new vote", async () => {
      const voteData = {
        eventId: TEST_EVENT_ID,
        participantId: TEST_PARTICIPANT_ID_1,
        venueId: TEST_VENUE_ID,
      };
      const mockVote = createMockVote();
      vi.mocked(mockPrisma.vote.create).mockResolvedValue(mockVote);

      const result = await repository.create(voteData);

      expect(mockPrisma.vote.create).toHaveBeenCalledWith({
        data: voteData,
      });
      expect(result).toEqual(mockVote);
    });
  });

  describe("findByEventId", () => {
    it("should find all votes for an event with venue details", async () => {
      const mockVenue = createMockVenue();
      const mockVotes = [
        { ...createMockVote(), venue: mockVenue },
        {
          ...createMockVote({
            id: "660e8400-e29b-41d4-a716-446655440001",
            participantId: TEST_PARTICIPANT_ID_2,
          }),
          venue: mockVenue,
        },
      ];
      vi.mocked(mockPrisma.vote.findMany).mockResolvedValue(mockVotes);

      const result = await repository.findByEventId(TEST_EVENT_ID);

      expect(mockPrisma.vote.findMany).toHaveBeenCalledWith({
        where: { eventId: TEST_EVENT_ID },
        include: { venue: true },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual(mockVotes);
      expect(result).toHaveLength(2);
    });

    it("should return empty array if no votes found", async () => {
      vi.mocked(mockPrisma.vote.findMany).mockResolvedValue([]);

      const result = await repository.findByEventId(TEST_EVENT_ID);

      expect(result).toEqual([]);
    });
  });

  describe("deleteByEventParticipantVenue", () => {
    it("should delete a specific vote", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 1 });

      const result = await repository.deleteByEventParticipantVenue(
        TEST_EVENT_ID,
        TEST_PARTICIPANT_ID_1,
        TEST_VENUE_ID
      );

      expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
        where: {
          eventId: TEST_EVENT_ID,
          participantId: TEST_PARTICIPANT_ID_1,
          venueId: TEST_VENUE_ID,
        },
      });
      expect(result).toBe(1);
    });

    it("should return 0 if vote does not exist", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 0 });

      const result = await repository.deleteByEventParticipantVenue(
        TEST_EVENT_ID,
        TEST_PARTICIPANT_ID_1,
        TEST_VENUE_ID
      );

      expect(result).toBe(0);
    });
  });

  describe("hasVoted", () => {
    it("should return true if vote exists", async () => {
      const mockVote = createMockVote();
      vi.mocked(mockPrisma.vote.findUnique).mockResolvedValue(mockVote);

      const result = await repository.hasVoted(
        TEST_EVENT_ID,
        TEST_PARTICIPANT_ID_1,
        TEST_VENUE_ID
      );

      expect(mockPrisma.vote.findUnique).toHaveBeenCalledWith({
        where: {
          eventId_participantId_venueId: {
            eventId: TEST_EVENT_ID,
            participantId: TEST_PARTICIPANT_ID_1,
            venueId: TEST_VENUE_ID,
          },
        },
      });
      expect(result).toBe(true);
    });

    it("should return false if vote does not exist", async () => {
      vi.mocked(mockPrisma.vote.findUnique).mockResolvedValue(null);

      const result = await repository.hasVoted(
        TEST_EVENT_ID,
        TEST_PARTICIPANT_ID_1,
        TEST_VENUE_ID
      );

      expect(result).toBe(false);
    });
  });

  describe("getVoteStatistics", () => {
    it("should return aggregated vote statistics", async () => {
      const mockVenue1 = createMockVenue();
      const mockVenue2 = createMockVenue({
        id: "ChIJN1t_tDeuEmsRUsoyG83frY5",
        name: "Another Venue",
      });

      const mockVotes = [
        { ...createMockVote(), venue: mockVenue1 },
        {
          ...createMockVote({
            id: "660e8400-e29b-41d4-a716-446655440001",
            participantId: TEST_PARTICIPANT_ID_2,
          }),
          venue: mockVenue1,
        },
        {
          ...createMockVote({
            id: "660e8400-e29b-41d4-a716-446655440002",
            venueId: mockVenue2.id,
          }),
          venue: mockVenue2,
        },
      ];

      vi.mocked(mockPrisma.vote.findMany).mockResolvedValue(mockVotes);

      const result = await repository.getVoteStatistics(TEST_EVENT_ID);

      expect(mockPrisma.vote.findMany).toHaveBeenCalledWith({
        where: { eventId: TEST_EVENT_ID },
        include: { venue: true },
      });

      expect(result).toHaveLength(2);
      // First venue should have 2 votes (sorted descending)
      expect(result[0].venue.id).toBe(TEST_VENUE_ID);
      expect(result[0].voteCount).toBe(2);
      expect(result[0].voterIds).toEqual([
        TEST_PARTICIPANT_ID_1,
        TEST_PARTICIPANT_ID_2,
      ]);
      // Second venue should have 1 vote
      expect(result[1].venue.id).toBe(mockVenue2.id);
      expect(result[1].voteCount).toBe(1);
      expect(result[1].voterIds).toEqual([TEST_PARTICIPANT_ID_1]);
    });

    it("should return empty array if no votes", async () => {
      vi.mocked(mockPrisma.vote.findMany).mockResolvedValue([]);

      const result = await repository.getVoteStatistics(TEST_EVENT_ID);

      expect(result).toEqual([]);
    });

    it("should handle single vote correctly", async () => {
      const mockVenue = createMockVenue();
      const mockVotes = [{ ...createMockVote(), venue: mockVenue }];

      vi.mocked(mockPrisma.vote.findMany).mockResolvedValue(mockVotes);

      const result = await repository.getVoteStatistics(TEST_EVENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].voteCount).toBe(1);
      expect(result[0].voterIds).toEqual([TEST_PARTICIPANT_ID_1]);
    });
  });

  describe("deleteByEventId", () => {
    it("should delete all votes for an event", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 5 });

      const result = await repository.deleteByEventId(TEST_EVENT_ID);

      expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
        where: { eventId: TEST_EVENT_ID },
      });
      expect(result).toBe(5);
    });

    it("should return 0 if no votes to delete", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 0 });

      const result = await repository.deleteByEventId(TEST_EVENT_ID);

      expect(result).toBe(0);
    });
  });

  describe("deleteByParticipantId", () => {
    it("should delete all votes for a participant", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 3 });

      const result = await repository.deleteByParticipantId(
        TEST_PARTICIPANT_ID_1
      );

      expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
        where: { participantId: TEST_PARTICIPANT_ID_1 },
      });
      expect(result).toBe(3);
    });

    it("should return 0 if no votes to delete", async () => {
      vi.mocked(mockPrisma.vote.deleteMany).mockResolvedValue({ count: 0 });

      const result = await repository.deleteByParticipantId(
        TEST_PARTICIPANT_ID_1
      );

      expect(result).toBe(0);
    });
  });
});
