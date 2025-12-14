/**
 * Unit tests for Google Maps Geocoding service.
 *
 * Tests geocoding with caching, retry logic, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocode, AddressNotFoundError, GeocodingApiError, isMapsConfigured } from "../../src/lib/maps.js";

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
    GEOCODE_CACHE_TTL_SECONDS: 2592000,
    GEOCODE_TIMEOUT_MS: 5000,
  },
}));

// Get mocked modules
import { redis } from "../../src/lib/redis.js";
import { config } from "../../src/lib/config.js";

const mockRedis = redis as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe("Maps Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("geocode", () => {
    const validApiResponse = {
      status: "OK",
      results: [
        {
          formatted_address: "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
          geometry: {
            location: {
              lat: 37.4224764,
              lng: -122.0842499,
            },
          },
        },
      ],
    };

    it("returns cached result when available", async () => {
      const cachedResult = {
        lat: 37.4224764,
        lng: -122.0842499,
        formattedAddress: "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await geocode("1600 Amphitheatre Parkway");

      expect(result).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalledWith("geocode:1600 amphitheatre parkway");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls Google API when cache misses", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validApiResponse),
      } as Response);

      const result = await geocode("1600 Amphitheatre Parkway");

      expect(result.lat).toBe(37.4224764);
      expect(result.lng).toBe(-122.0842499);
      expect(result.formattedAddress).toBe("1600 Amphitheatre Parkway, Mountain View, CA 94043, USA");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("caches successful API response", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validApiResponse),
      } as Response);

      await geocode("1600 Amphitheatre Parkway");

      expect(mockRedis.set).toHaveBeenCalledWith(
        "geocode:1600 amphitheatre parkway",
        expect.any(String),
        "EX",
        2592000
      );
    });

    it("normalizes address for cache key", async () => {
      const cachedResult = {
        lat: 37.4224764,
        lng: -122.0842499,
        formattedAddress: "Test Address",
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Test various address formats that should normalize to the same key
      await geocode("  Test   Address  ");

      expect(mockRedis.get).toHaveBeenCalledWith("geocode:test address");
    });

    it("throws AddressNotFoundError for ZERO_RESULTS", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
      } as Response);

      await expect(geocode("nonexistent address xyz123")).rejects.toThrow(AddressNotFoundError);
    });

    it("throws AddressNotFoundError when results array is empty", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "OK", results: [] }),
      } as Response);

      await expect(geocode("empty result address")).rejects.toThrow(AddressNotFoundError);
    });

    it("throws GeocodingApiError for REQUEST_DENIED", async () => {
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

      await expect(geocode("test address")).rejects.toThrow(GeocodingApiError);
    });

    it("throws GeocodingApiError for INVALID_REQUEST", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "INVALID_REQUEST",
            results: [],
            error_message: "Missing address parameter",
          }),
      } as Response);

      await expect(geocode("")).rejects.toThrow(GeocodingApiError);
    });

    it("retries on OVER_QUERY_LIMIT with exponential backoff", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      // First two calls fail with rate limit, third succeeds
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "OVER_QUERY_LIMIT", results: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "OVER_QUERY_LIMIT", results: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validApiResponse),
        } as Response);

      const result = await geocode("retry test address");

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.lat).toBe(37.4224764);
    });

    it("does not retry on AddressNotFoundError", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
      } as Response);

      await expect(geocode("nonexistent")).rejects.toThrow(AddressNotFoundError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on REQUEST_DENIED", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "REQUEST_DENIED",
            results: [],
          }),
      } as Response);

      await expect(geocode("test")).rejects.toThrow(GeocodingApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("retries on network errors", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validApiResponse),
        } as Response);

      const result = await geocode("network retry test");

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.lat).toBe(37.4224764);
    });

    it("throws after max retries exhausted", async () => {
      mockRedis.get.mockResolvedValue(null);

      vi.mocked(fetch).mockRejectedValue(new Error("Persistent network error"));

      await expect(geocode("persistent failure")).rejects.toThrow("Persistent network error");
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("handles HTTP error responses", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(geocode("http error test")).rejects.toThrow(GeocodingApiError);
    });

    it("continues working if cache read fails", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis connection error"));
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validApiResponse),
      } as Response);

      const result = await geocode("cache error test");

      expect(result.lat).toBe(37.4224764);
    });

    it("continues working if cache write fails", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockRejectedValue(new Error("Redis write error"));
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validApiResponse),
      } as Response);

      const result = await geocode("cache write error test");

      expect(result.lat).toBe(37.4224764);
    });

    it("encodes special characters in address", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validApiResponse),
      } as Response);

      await geocode("123 Main St #5, New York, NY");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("123 Main St #5, New York, NY")),
        expect.any(Object)
      );
    });
  });

  describe("isMapsConfigured", () => {
    it("returns true when API key is set", () => {
      expect(isMapsConfigured()).toBe(true);
    });

    it("returns false when API key is empty", async () => {
      // Temporarily modify config for this test
      const originalKey = config.GOOGLE_MAPS_API_KEY;
      (config as { GOOGLE_MAPS_API_KEY: string }).GOOGLE_MAPS_API_KEY = "";

      expect(isMapsConfigured()).toBe(false);

      // Restore
      (config as { GOOGLE_MAPS_API_KEY: string }).GOOGLE_MAPS_API_KEY = originalKey;
    });
  });

  describe("AddressNotFoundError", () => {
    it("has correct name and message", () => {
      const error = new AddressNotFoundError("123 Fake St");
      expect(error.name).toBe("AddressNotFoundError");
      expect(error.message).toBe("Address not found: 123 Fake St");
    });
  });

  describe("GeocodingApiError", () => {
    it("has correct name, message, and status", () => {
      const error = new GeocodingApiError("API quota exceeded", "OVER_QUERY_LIMIT");
      expect(error.name).toBe("GeocodingApiError");
      expect(error.message).toBe("API quota exceeded");
      expect(error.status).toBe("OVER_QUERY_LIMIT");
    });
  });
});
