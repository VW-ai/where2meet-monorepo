/**
 * Unit tests for Venue repository.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VenueRepository } from "../../src/repositories/venue.js";
import type { PrismaClient, Venue } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/** Test Google Place ID */
const TEST_PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  return {
    venue: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient;
}

/**
 * Creates a mock venue entity.
 */
function createMockVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: TEST_PLACE_ID,
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

describe("VenueRepository", () => {
  let mockPrisma: PrismaClient;
  let repository: VenueRepository;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repository = new VenueRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should find a venue by place ID", async () => {
      const mockVenue = createMockVenue();
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(mockVenue);

      const result = await repository.findById(TEST_PLACE_ID);

      expect(mockPrisma.venue.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_PLACE_ID },
      });
      expect(result).toEqual(mockVenue);
    });

    it("should return null if venue not found", async () => {
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(null);

      const result = await repository.findById(TEST_PLACE_ID);

      expect(result).toBeNull();
    });
  });

  describe("isStale", () => {
    it("should return true if venue does not exist", async () => {
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(null);

      const result = await repository.isStale(TEST_PLACE_ID);

      expect(result).toBe(true);
    });

    it("should return true if venue is >= 5 days old", async () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const mockVenue = createMockVenue({ updatedAt: sixDaysAgo });
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(mockVenue);

      const result = await repository.isStale(TEST_PLACE_ID);

      expect(result).toBe(true);
    });

    it("should return true if venue is exactly 5 days old", async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const mockVenue = createMockVenue({ updatedAt: fiveDaysAgo });
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(mockVenue);

      const result = await repository.isStale(TEST_PLACE_ID);

      expect(result).toBe(true);
    });

    it("should return false if venue is < 5 days old", async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const mockVenue = createMockVenue({ updatedAt: threeDaysAgo });
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(mockVenue);

      const result = await repository.isStale(TEST_PLACE_ID);

      expect(result).toBe(false);
    });

    it("should return false if venue is freshly updated", async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const mockVenue = createMockVenue({ updatedAt: oneHourAgo });
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue(mockVenue);

      const result = await repository.isStale(TEST_PLACE_ID);

      expect(result).toBe(false);
    });
  });

  describe("upsert", () => {
    const venueData = {
      id: TEST_PLACE_ID,
      name: "New Venue",
      address: "456 New St",
      lat: 40.7589,
      lng: -73.9851,
      category: "cafe",
      rating: 4.8,
      priceLevel: 3,
      photoUrl: "https://example.com/new-photo.jpg",
    };

    it("should create a new venue if it does not exist", async () => {
      const mockVenue = createMockVenue(venueData);
      vi.mocked(mockPrisma.venue.upsert).mockResolvedValue(mockVenue);

      const result = await repository.upsert(venueData);

      expect(mockPrisma.venue.upsert).toHaveBeenCalledWith({
        where: { id: TEST_PLACE_ID },
        update: expect.objectContaining({
          name: venueData.name,
          address: venueData.address,
          lat: venueData.lat,
          lng: venueData.lng,
          category: venueData.category,
          rating: venueData.rating,
          priceLevel: venueData.priceLevel,
          photoUrl: venueData.photoUrl,
          updatedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          id: venueData.id,
          name: venueData.name,
          address: venueData.address,
          lat: venueData.lat,
          lng: venueData.lng,
          category: venueData.category,
          rating: venueData.rating,
          priceLevel: venueData.priceLevel,
          photoUrl: venueData.photoUrl,
        }),
      });
      expect(result).toEqual(mockVenue);
    });

    it("should update an existing venue", async () => {
      const updatedVenue = createMockVenue({
        ...venueData,
        updatedAt: new Date(),
      });
      vi.mocked(mockPrisma.venue.upsert).mockResolvedValue(updatedVenue);

      const result = await repository.upsert(venueData);

      expect(mockPrisma.venue.upsert).toHaveBeenCalled();
      expect(result).toEqual(updatedVenue);
    });

    it("should handle null values for optional fields", async () => {
      const venueDataWithNulls = {
        ...venueData,
        address: null,
        category: null,
        rating: null,
        priceLevel: null,
        photoUrl: null,
      };
      const mockVenue = createMockVenue(venueDataWithNulls);
      vi.mocked(mockPrisma.venue.upsert).mockResolvedValue(mockVenue);

      const result = await repository.upsert(venueDataWithNulls);

      expect(mockPrisma.venue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            address: null,
            category: null,
            rating: null,
            priceLevel: null,
            photoUrl: null,
          }),
          create: expect.objectContaining({
            address: null,
            category: null,
            rating: null,
            priceLevel: null,
            photoUrl: null,
          }),
        })
      );
      expect(result).toEqual(mockVenue);
    });
  });

  describe("delete", () => {
    it("should delete a venue by place ID", async () => {
      vi.mocked(mockPrisma.venue.delete).mockResolvedValue(
        createMockVenue()
      );

      await repository.delete(TEST_PLACE_ID);

      expect(mockPrisma.venue.delete).toHaveBeenCalledWith({
        where: { id: TEST_PLACE_ID },
      });
    });
  });
});
