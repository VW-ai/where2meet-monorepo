/**
 * Unit tests for VenueService.
 *
 * Tests venue search and details operations with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VenueService } from "../../src/services/venue.js";
import type { PrismaClient } from "@prisma/client";
import { ExternalServiceError } from "../../src/types/errors.js";
import type { GeoPoint } from "../../src/types/geo.js";

// Mock Places API
vi.mock("../../src/lib/places/index.js", () => ({
  searchNearbyPlaces: vi.fn(),
  textSearchPlaces: vi.fn(),
  getPlaceDetails: vi.fn(),
  buildPhotoUrl: vi.fn((photoRef: string) => `https://mocked-photo-url/${photoRef}`),
  PlacesApiError: class PlacesApiError extends Error {
    constructor(
      message: string,
      public status: string
    ) {
      super(message);
      this.name = "PlacesApiError";
    }
  },
  CATEGORY_TO_PLACE_TYPE: {
    cafe: "cafe",
    restaurant: "restaurant",
    bar: "bar",
    park: "park",
    library: "library",
    gym: "gym",
    museum: "museum",
    shopping: "shopping_mall",
    things_to_do: "tourist_attraction",
  },
}));

import { searchNearbyPlaces, textSearchPlaces, getPlaceDetails } from "../../src/lib/places/index.js";

/**
 * Creates a mock Prisma client for testing.
 */
function createMockPrisma() {
  return {} as unknown as PrismaClient;
}

// Test center coordinates (NYC midtown)
const testCenter: GeoPoint = { lat: 40.7484, lng: -73.9857 };

/**
 * Creates a mock place result.
 */
function createMockPlace(overrides: Partial<{
  placeId: string;
  name: string;
  rating: number | null;
}> = {}) {
  return {
    placeId: overrides.placeId ?? "ChIJ123",
    name: overrides.name ?? "Test Place",
    address: "123 Main St",
    location: { lat: 40.7128, lng: -74.006 },
    types: ["cafe"],
    rating: "rating" in overrides ? overrides.rating : 4.5,
    userRatingsTotal: 100,
    priceLevel: 2,
    openNow: true,
    photoReference: "photo123",
  };
}

describe("VenueService", () => {
  let service: VenueService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new VenueService(mockPrisma);
  });

  describe("searchVenues", () => {
    it("should search venues using text query", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([createMockPlace()]);

      const result = await service.searchVenues(testCenter, 5000, {
        query: "coffee",
      });

      expect(textSearchPlaces).toHaveBeenCalledWith("coffee", testCenter, 5000);
      expect(result.places).toHaveLength(1);
      expect(result.searchCenter).toEqual(testCenter);
    });

    it("should search venues using categories", async () => {
      vi.mocked(searchNearbyPlaces).mockResolvedValue([createMockPlace()]);

      const result = await service.searchVenues(testCenter, 5000, {
        categories: ["cafe"],
      });

      expect(searchNearbyPlaces).toHaveBeenCalledWith(testCenter, 5000, { type: "cafe" });
      expect(result.places).toHaveLength(1);
    });

    it("should search with both query and categories", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([createMockPlace({ placeId: "text1" })]);
      vi.mocked(searchNearbyPlaces).mockResolvedValue([createMockPlace({ placeId: "nearby1" })]);

      const result = await service.searchVenues(testCenter, 5000, {
        query: "lunch",
        categories: ["restaurant"],
      });

      expect(textSearchPlaces).toHaveBeenCalled();
      expect(searchNearbyPlaces).toHaveBeenCalled();
      expect(result.places).toHaveLength(2);
    });

    it("should deduplicate places by placeId", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([createMockPlace({ placeId: "same" })]);
      vi.mocked(searchNearbyPlaces).mockResolvedValue([createMockPlace({ placeId: "same" })]);

      const result = await service.searchVenues(testCenter, 5000, {
        query: "coffee",
        categories: ["cafe"],
      });

      expect(result.places).toHaveLength(1);
    });

    it("should sort places by rating (highest first)", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([
        createMockPlace({ placeId: "low", rating: 3.0 }),
        createMockPlace({ placeId: "high", rating: 4.8 }),
        createMockPlace({ placeId: "mid", rating: 4.0 }),
      ]);

      const result = await service.searchVenues(testCenter, 5000, {
        query: "coffee",
      });

      expect(result.places[0].rating).toBe(4.8);
      expect(result.places[1].rating).toBe(4.0);
      expect(result.places[2].rating).toBe(3.0);
    });

    it("should put null ratings last", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([
        createMockPlace({ placeId: "norating", name: "No Rating", rating: null }),
        createMockPlace({ placeId: "rated", name: "Rated", rating: 4.0 }),
      ]);

      const result = await service.searchVenues(testCenter, 5000, {
        query: "coffee",
      });

      expect(result.places[0].name).toBe("Rated");
      expect(result.places[0].rating).toBe(4.0);
      expect(result.places[1].name).toBe("No Rating");
      expect(result.places[1].rating).toBeNull();
    });

    it("should throw ExternalServiceError on Places API failure", async () => {
      const { PlacesApiError } = await import("../../src/lib/places/index.js");
      vi.mocked(textSearchPlaces).mockRejectedValue(
        new PlacesApiError("API quota exceeded", "OVER_QUERY_LIMIT")
      );

      await expect(
        service.searchVenues(testCenter, 5000, { query: "coffee" })
      ).rejects.toThrow("API quota exceeded");
    });

    it("should search multiple categories", async () => {
      vi.mocked(searchNearbyPlaces)
        .mockResolvedValueOnce([createMockPlace({ placeId: "cafe1" })])
        .mockResolvedValueOnce([createMockPlace({ placeId: "restaurant1" })]);

      const result = await service.searchVenues(testCenter, 5000, {
        categories: ["cafe", "restaurant"],
      });

      expect(searchNearbyPlaces).toHaveBeenCalledTimes(2);
      expect(result.places).toHaveLength(2);
    });
  });

  describe("getVenueDetails", () => {
    it("should return place details", async () => {
      const mockDetails = {
        ...createMockPlace(),
        formattedPhoneNumber: "(212) 555-1234",
        website: "https://example.com",
        openingHours: ["Monday: 9 AM - 5 PM"],
      };
      vi.mocked(getPlaceDetails).mockResolvedValue(mockDetails);

      const result = await service.getVenueDetails("ChIJ123");

      expect(getPlaceDetails).toHaveBeenCalledWith("ChIJ123");
      expect(result).toEqual(mockDetails);
    });

    it("should throw ExternalServiceError on Places API failure", async () => {
      const { PlacesApiError } = await import("../../src/lib/places/index.js");
      vi.mocked(getPlaceDetails).mockRejectedValue(
        new PlacesApiError("Place not found", "NOT_FOUND")
      );

      await expect(service.getVenueDetails("invalid")).rejects.toThrow("Place not found");
    });
  });
});
