/**
 * Unit tests for Google Places API service.
 *
 * Tests nearby search, text search, place details with caching, retry logic, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
  buildPhotoUrl,
  isPlacesConfigured,
  PlaceNotFoundError,
  PlacesApiError,
  CATEGORY_TO_PLACE_TYPE,
} from "../../src/lib/places/index.js";

// Mock Redis
vi.mock("../../src/lib/redis.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock config
vi.mock("../../src/lib/config.js", () => ({
  config: {
    GOOGLE_MAPS_API_KEY: "test-api-key",
    PLACES_SEARCH_CACHE_TTL_SECONDS: 3600,
    PLACES_DETAILS_CACHE_TTL_SECONDS: 86400,
    PLACES_TIMEOUT_MS: 5000,
  },
}));

// Get mocked modules
import { redis } from "../../src/lib/redis.js";
import { config } from "../../src/lib/config.js";

const mockRedis = redis as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe("Places Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const center = { lat: 40.7128, lng: -74.006 };

  const mockGooglePlace = {
    place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    name: "Test Cafe",
    vicinity: "123 Main St, New York",
    geometry: {
      location: { lat: 40.7128, lng: -74.006 },
    },
    types: ["cafe", "food", "establishment"],
    rating: 4.5,
    user_ratings_total: 150,
    price_level: 2,
    opening_hours: { open_now: true },
    photos: [{ photo_reference: "photo_ref_123" }],
  };

  const mockNearbySearchResponse = {
    status: "OK",
    results: [mockGooglePlace],
  };

  const mockDetailsResponse = {
    status: "OK",
    result: {
      ...mockGooglePlace,
      formatted_address: "123 Main St, New York, NY 10001",
      formatted_phone_number: "(212) 555-1234",
      website: "https://testcafe.com",
      opening_hours: {
        open_now: true,
        weekday_text: [
          "Monday: 7:00 AM – 9:00 PM",
          "Tuesday: 7:00 AM – 9:00 PM",
        ],
      },
    },
  };

  describe("searchNearbyPlaces", () => {
    it("returns cached results when available", async () => {
      const cachedResults = [
        {
          placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          name: "Cached Cafe",
          address: "123 Main St",
          location: { lat: 40.7128, lng: -74.006 },
          types: ["cafe"],
          rating: 4.5,
          userRatingsTotal: 150,
          priceLevel: 2,
          openNow: true,
          photoReference: "photo_ref",
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResults));

      const results = await searchNearbyPlaces(center, 5000);

      expect(results).toEqual(cachedResults);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls Google API when cache misses", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(results).toHaveLength(1);
      expect(results[0].placeId).toBe("ChIJN1t_tDeuEmsRUsoyG83frY4");
      expect(results[0].name).toBe("Test Cafe");
      expect(results[0].rating).toBe(4.5);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("caches successful API response", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await searchNearbyPlaces(center, 5000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining("places:search:"),
        expect.any(String),
        "EX",
        3600
      );
    });

    it("includes type parameter when specified", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await searchNearbyPlaces(center, 5000, { type: "cafe" });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("type=cafe"),
        expect.any(Object)
      );
    });

    it("includes keyword parameter when specified", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await searchNearbyPlaces(center, 5000, { keyword: "coffee" });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("keyword=coffee"),
        expect.any(Object)
      );
    });

    it("returns empty array for ZERO_RESULTS", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
      } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(results).toEqual([]);
    });

    it("throws PlacesApiError for REQUEST_DENIED", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "REQUEST_DENIED",
            results: [],
            error_message: "API key is invalid",
          }),
      } as Response);

      await expect(searchNearbyPlaces(center, 5000)).rejects.toThrow(PlacesApiError);
    });

    it("retries on OVER_QUERY_LIMIT", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "OVER_QUERY_LIMIT", results: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNearbySearchResponse),
        } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(1);
    });

    it("retries on network errors", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNearbySearchResponse),
        } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(1);
    });

    it("throws after max retries exhausted", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockRejectedValue(new Error("Persistent failure"));

      await expect(searchNearbyPlaces(center, 5000)).rejects.toThrow("Persistent failure");
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("normalizes coordinates in cache key", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await searchNearbyPlaces({ lat: 40.71284567, lng: -74.00612345 }, 5000);

      // Should normalize to 4 decimal places
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining("40.7128,-74.0061")
      );
    });

    it("continues working if cache read fails", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis error"));
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(results).toHaveLength(1);
    });

    it("continues working if cache write fails", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockRejectedValue(new Error("Redis write error"));
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      const results = await searchNearbyPlaces(center, 5000);

      expect(results).toHaveLength(1);
    });
  });

  describe("textSearchPlaces", () => {
    it("returns cached results when available", async () => {
      const cachedResults = [
        {
          placeId: "test-id",
          name: "Starbucks",
          address: "456 Oak St",
          location: { lat: 40.7128, lng: -74.006 },
          types: ["cafe"],
          rating: 4.0,
          userRatingsTotal: 200,
          priceLevel: 2,
          openNow: true,
          photoReference: null,
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResults));

      const results = await textSearchPlaces("starbucks", center, 5000);

      expect(results).toEqual(cachedResults);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls Google API with query parameter", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await textSearchPlaces("best coffee", center, 5000);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("query=best+coffee"),
        expect.any(Object)
      );
    });

    it("includes location bias in request", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await textSearchPlaces("pizza", center, 5000);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("location=40.7128%2C-74.006"),
        expect.any(Object)
      );
    });

    it("caches results with normalized query in key", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNearbySearchResponse),
      } as Response);

      await textSearchPlaces("  Coffee  Shop  ", center, 5000);

      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining("coffee_shop")
      );
    });
  });

  describe("getPlaceDetails", () => {
    const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    it("returns cached details when available", async () => {
      const cachedDetails = {
        placeId,
        name: "Cached Place",
        address: "123 Main St",
        location: { lat: 40.7128, lng: -74.006 },
        types: ["cafe"],
        rating: 4.5,
        userRatingsTotal: 150,
        priceLevel: 2,
        openNow: true,
        photoReference: "photo_ref",
        formattedPhoneNumber: "(212) 555-1234",
        website: "https://example.com",
        openingHours: ["Monday: 9 AM - 5 PM"],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedDetails));

      const details = await getPlaceDetails(placeId);

      expect(details).toEqual(cachedDetails);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls Google API with correct fields", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDetailsResponse),
      } as Response);

      await getPlaceDetails(placeId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("place_id=" + placeId),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("fields="),
        expect.any(Object)
      );
    });

    it("returns full place details", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDetailsResponse),
      } as Response);

      const details = await getPlaceDetails(placeId);

      expect(details.placeId).toBe(placeId);
      expect(details.name).toBe("Test Cafe");
      expect(details.formattedPhoneNumber).toBe("(212) 555-1234");
      expect(details.website).toBe("https://testcafe.com");
      expect(details.openingHours).toHaveLength(2);
    });

    it("caches details with 24-hour TTL", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDetailsResponse),
      } as Response);

      await getPlaceDetails(placeId);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `places:details:${placeId}`,
        expect.any(String),
        "EX",
        86400
      );
    });

    it("throws PlaceNotFoundError when result is missing", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "OK", result: null }),
      } as Response);

      await expect(getPlaceDetails(placeId)).rejects.toThrow(PlaceNotFoundError);
    });

    it("throws PlacesApiError for NOT_FOUND status", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "NOT_FOUND", error_message: "Place not found" }),
      } as Response);

      await expect(getPlaceDetails(placeId)).rejects.toThrow(PlacesApiError);
    });

    it("handles missing optional fields", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            result: {
              place_id: placeId,
              name: "Minimal Place",
              geometry: { location: { lat: 40.7128, lng: -74.006 } },
            },
          }),
      } as Response);

      const details = await getPlaceDetails(placeId);

      expect(details.rating).toBeNull();
      expect(details.priceLevel).toBeNull();
      expect(details.photoReference).toBeNull();
      expect(details.formattedPhoneNumber).toBeNull();
      expect(details.website).toBeNull();
      expect(details.openingHours).toBeNull();
    });
  });

  describe("buildPhotoUrl", () => {
    it("builds correct photo URL with default width", () => {
      const url = buildPhotoUrl("photo_reference_123");

      expect(url).toContain("photoreference=photo_reference_123");
      expect(url).toContain("maxwidth=400");
      expect(url).toContain("key=test-api-key");
    });

    it("builds correct photo URL with custom width", () => {
      const url = buildPhotoUrl("photo_ref", 800);

      expect(url).toContain("maxwidth=800");
    });
  });

  describe("isPlacesConfigured", () => {
    it("returns true when API key is set", () => {
      expect(isPlacesConfigured()).toBe(true);
    });

    it("returns false when API key is empty", () => {
      const originalKey = config.GOOGLE_MAPS_API_KEY;
      (config as { GOOGLE_MAPS_API_KEY: string }).GOOGLE_MAPS_API_KEY = "";

      expect(isPlacesConfigured()).toBe(false);

      (config as { GOOGLE_MAPS_API_KEY: string }).GOOGLE_MAPS_API_KEY = originalKey;
    });
  });

  describe("CATEGORY_TO_PLACE_TYPE", () => {
    it("contains expected category mappings", () => {
      expect(CATEGORY_TO_PLACE_TYPE.cafe).toBe("cafe");
      expect(CATEGORY_TO_PLACE_TYPE.restaurant).toBe("restaurant");
      expect(CATEGORY_TO_PLACE_TYPE.bar).toBe("bar");
      expect(CATEGORY_TO_PLACE_TYPE.park).toBe("park");
      expect(CATEGORY_TO_PLACE_TYPE.library).toBe("library");
      expect(CATEGORY_TO_PLACE_TYPE.gym).toBe("gym");
      expect(CATEGORY_TO_PLACE_TYPE.museum).toBe("museum");
      expect(CATEGORY_TO_PLACE_TYPE.shopping).toBe("shopping_mall");
      expect(CATEGORY_TO_PLACE_TYPE.things_to_do).toBe("tourist_attraction");
    });
  });

  describe("PlaceNotFoundError", () => {
    it("has correct name and message", () => {
      const error = new PlaceNotFoundError("ChIJ123");
      expect(error.name).toBe("PlaceNotFoundError");
      expect(error.message).toBe("Place not found: ChIJ123");
    });
  });

  describe("PlacesApiError", () => {
    it("has correct name, message, and status", () => {
      const error = new PlacesApiError("API quota exceeded", "OVER_QUERY_LIMIT");
      expect(error.name).toBe("PlacesApiError");
      expect(error.message).toBe("API quota exceeded");
      expect(error.status).toBe("OVER_QUERY_LIMIT");
    });
  });
});
