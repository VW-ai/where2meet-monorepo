/**
 * Integration tests for Venue endpoints.
 *
 * Tests the full request/response cycle for venue search and details.
 * Mocks Google Places API to avoid external calls.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

// Mock Places API module
vi.mock("../src/lib/places/index.js", async () => {
  const actual = await vi.importActual("../src/lib/places/index.js");
  return {
    ...actual,
    searchNearbyPlaces: vi.fn(),
    textSearchPlaces: vi.fn(),
    getPlaceDetails: vi.fn(),
  };
});

// Mock Geocoding API for participant creation
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockImplementation((address: string) => {
    // Return mock coordinates based on address
    if (address.includes("350 5th Ave")) {
      return Promise.resolve({
        lat: 40.7484,
        lng: -73.9857,
        formattedAddress: "350 5th Ave, New York, NY 10118, USA",
      });
    }
    if (address.includes("World Trade Center")) {
      return Promise.resolve({
        lat: 40.7127,
        lng: -74.0134,
        formattedAddress: "1 World Trade Center, New York, NY 10007, USA",
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

import {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
} from "../src/lib/places/index.js";

/**
 * Creates a mock place result.
 */
function createMockPlace(overrides: Partial<{
  placeId: string;
  name: string;
  rating: number | null;
}> = {}) {
  return {
    placeId: overrides.placeId ?? "ChIJ123456789",
    name: overrides.name ?? "Test Cafe",
    address: "123 Main St, New York, NY",
    location: { lat: 40.7128, lng: -74.006 },
    types: ["cafe", "food"],
    rating: "rating" in overrides ? overrides.rating : 4.5,
    userRatingsTotal: 150,
    priceLevel: 2,
    openNow: true,
    photoReference: "photo_ref_123",
  };
}

describe("Venue Endpoints", () => {
  let server: FastifyInstance;

  // Test center coordinates (NYC midtown)
  const testCenter = { lat: 40.7484, lng: -73.9857 };

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("POST /api/venues/search", () => {
    it("should search venues with query", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([
        createMockPlace({ placeId: "place1", name: "Starbucks" }),
        createMockPlace({ placeId: "place2", name: "Blue Bottle Coffee" }),
      ]);

      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: testCenter,
          searchRadius: 5000,
          query: "coffee",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("venues");
      expect(body).toHaveProperty("totalResults", 2);
      expect(body).toHaveProperty("searchCenter");
      expect(body.venues).toHaveLength(2);
      expect(body.venues[0]).toHaveProperty("id");
      expect(body.venues[0]).toHaveProperty("name");
      expect(body.venues[0]).toHaveProperty("location");
    });

    it("should search venues with categories", async () => {
      vi.mocked(searchNearbyPlaces).mockResolvedValue([
        createMockPlace({ placeId: "cafe1", name: "Local Cafe" }),
      ]);

      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: testCenter,
          searchRadius: 3000,
          categories: ["cafe"],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues).toHaveLength(1);
      expect(body.venues[0].name).toBe("Local Cafe");
    });

    it("should return 400 for missing center", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          searchRadius: 5000,
          query: "coffee",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid center coordinates", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: { lat: 91, lng: -74.006 }, // lat out of range
          searchRadius: 5000,
          query: "coffee",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for missing query and categories", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: testCenter,
          searchRadius: 5000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("query or categories");
    });

    it("should return 400 for invalid searchRadius", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: testCenter,
          searchRadius: 50, // Too small (min 100)
          query: "coffee",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return venues sorted by rating", async () => {
      vi.mocked(textSearchPlaces).mockResolvedValue([
        createMockPlace({ placeId: "low", name: "Low Rated", rating: 3.0 }),
        createMockPlace({ placeId: "high", name: "High Rated", rating: 4.8 }),
        createMockPlace({ placeId: "mid", name: "Mid Rated", rating: 4.2 }),
      ]);

      const response = await server.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: {
          center: testCenter,
          searchRadius: 5000,
          query: "restaurant",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.venues[0].rating).toBe(4.8);
      expect(body.venues[1].rating).toBe(4.2);
      expect(body.venues[2].rating).toBe(3.0);
    });
  });

  describe("GET /api/venues/:id", () => {
    it("should return venue details", async () => {
      vi.mocked(getPlaceDetails).mockResolvedValue({
        ...createMockPlace({ placeId: "ChIJ123", name: "Test Venue" }),
        formattedPhoneNumber: "(212) 555-1234",
        website: "https://testvenue.com",
        openingHours: ["Monday: 9:00 AM – 9:00 PM", "Tuesday: 9:00 AM – 9:00 PM"],
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/venues/ChIJ123",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("id", "ChIJ123");
      expect(body).toHaveProperty("name", "Test Venue");
      expect(body).toHaveProperty("formattedPhoneNumber", "(212) 555-1234");
      expect(body).toHaveProperty("website", "https://testvenue.com");
      expect(body).toHaveProperty("openingHours");
      expect(body.openingHours).toHaveLength(2);
    });

    it("should return venue with photo URL", async () => {
      vi.mocked(getPlaceDetails).mockResolvedValue({
        ...createMockPlace({ placeId: "ChIJWithPhoto" }),
        formattedPhoneNumber: null,
        website: null,
        openingHours: null,
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/venues/ChIJWithPhoto",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.photoUrl).toContain("maps.googleapis.com");
      expect(body.photoUrl).toContain("photo_ref_123");
    });
  });
});
