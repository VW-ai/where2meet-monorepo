/**
 * Integration tests for the AMap lookup endpoints.
 *
 * Mocks the AMap module; no database is needed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../src/lib/amap/index.js", async () => {
  const actual = await vi.importActual("../src/lib/amap/index.js");
  return { ...actual, amapSuggest: vi.fn(), amapReverseGeocode: vi.fn() };
});

import { buildServer } from "../src/server.js";
import { amapSuggest, amapReverseGeocode } from "../src/lib/amap/index.js";
import { AddressNotFoundError, GeocodingApiError } from "../src/lib/maps.js";
import { PlacesApiError } from "../src/lib/places/index.js";

describe("AMap Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/amap/suggest", () => {
    const suggestion = {
      placeId: "amap:B000A9KXWR",
      name: "三里屯太古里",
      district: "北京市朝阳区",
      address: "三里屯路19号",
      location: { lat: 39.9334, lng: 116.4479 },
    };

    it("returns suggestions biased to a point", async () => {
      vi.mocked(amapSuggest).mockResolvedValue([suggestion]);

      const response = await server.inject({
        method: "GET",
        url: `/api/amap/suggest?q=${encodeURIComponent("三里屯")}&lat=39.9&lng=116.4`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ suggestions: [suggestion] });
      expect(amapSuggest).toHaveBeenCalledWith("三里屯", { lat: 39.9, lng: 116.4 });
    });

    it("searches nationwide without a point", async () => {
      vi.mocked(amapSuggest).mockResolvedValue([]);

      const response = await server.inject({ method: "GET", url: "/api/amap/suggest?q=gm" });

      expect(response.statusCode).toBe(200);
      expect(amapSuggest).toHaveBeenCalledWith("gm", undefined);
    });

    it("rejects a one-character query", async () => {
      const response = await server.inject({ method: "GET", url: "/api/amap/suggest?q=a" });

      expect(response.statusCode).toBe(400);
      expect(amapSuggest).not.toHaveBeenCalled();
    });

    it("rejects lat without lng", async () => {
      const response = await server.inject({ method: "GET", url: "/api/amap/suggest?q=abc&lat=39" });

      expect(response.statusCode).toBe(400);
    });

    it("returns 502 when AMap fails", async () => {
      vi.mocked(amapSuggest).mockRejectedValue(new PlacesApiError("quota", "OVER_DAILY_LIMIT"));

      const response = await server.inject({ method: "GET", url: "/api/amap/suggest?q=abc" });

      expect(response.statusCode).toBe(502);
    });
  });

  describe("GET /api/amap/reverse-geocode", () => {
    it("returns the address with the requested WGS-84 location", async () => {
      vi.mocked(amapReverseGeocode).mockResolvedValue({
        formattedAddress: "北京市朝阳区三里屯路19号",
        cityCode: "010",
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/amap/reverse-geocode?lat=39.9334&lng=116.4479",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        formattedAddress: "北京市朝阳区三里屯路19号",
        location: { lat: 39.9334, lng: 116.4479 },
      });
    });

    it("returns 400 without coordinates", async () => {
      const response = await server.inject({ method: "GET", url: "/api/amap/reverse-geocode" });

      expect(response.statusCode).toBe(400);
    });

    it("returns the address-not-found error when AMap has no address", async () => {
      vi.mocked(amapReverseGeocode).mockRejectedValue(new AddressNotFoundError());

      const response = await server.inject({
        method: "GET",
        url: "/api/amap/reverse-geocode?lat=10&lng=10",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("ADDRESS_NOT_FOUND");
    });

    it("returns 502 when AMap fails", async () => {
      vi.mocked(amapReverseGeocode).mockRejectedValue(
        new GeocodingApiError("denied", "REQUEST_DENIED")
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/amap/reverse-geocode?lat=39.9&lng=116.4",
      });

      expect(response.statusCode).toBe(502);
    });
  });
});
