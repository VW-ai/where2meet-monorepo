/**
 * Unit tests for the AMap Web Service integration.
 *
 * Responses follow the field tables in AMap's Web Service docs. Coordinates in
 * responses are GCJ-02 and must come out as WGS-84.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/redis.js", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("../../src/lib/places/redis.js", () => ({
  placesRedis: { status: "ready", get: vi.fn(), set: vi.fn(), connect: vi.fn() },
}));

vi.mock("../../src/lib/config.js", () => ({
  config: {
    AMAP_WEB_SERVICE_KEY: "test-amap-key",
    AMAP_TIMEOUT_MS: 5000,
    GEOCODE_CACHE_TTL_SECONDS: 2592000,
    PLACES_SEARCH_CACHE_TTL_SECONDS: 3600,
    PLACES_DETAILS_CACHE_TTL_SECONDS: 86400,
    DIRECTIONS_CACHE_TTL_SECONDS: 3600,
  },
}));

import { redis } from "../../src/lib/redis.js";
import { placesRedis } from "../../src/lib/places/redis.js";
import { config } from "../../src/lib/config.js";
import { statusForInfocode } from "../../src/lib/amap/errors.js";
import {
  fromAmapLocation,
  fromAmapPolyline,
  isAmapVenueId,
  text,
  toAmapLocation,
} from "../../src/lib/amap/parse.js";
import { googleTypesForTypecode } from "../../src/lib/amap/categories.js";
import {
  amapGeocode,
  amapReverseGeocode,
  amapSuggest,
  amapSearchNearby,
  amapTextSearch,
  amapGetDetails,
  amapCalculateRoute,
  amapCalculateBatchRoutes,
} from "../../src/lib/amap/index.js";
import { AddressNotFoundError, GeocodingApiError } from "../../src/lib/maps.js";
import { PlacesApiError } from "../../src/lib/places/errors.js";
import { DirectionsApiError } from "../../src/lib/directions/errors.js";
import { gcj02ToWgs84, wgs84ToGcj02 } from "../../src/lib/geo/coords.js";
import { encodePolyline } from "../../src/lib/geo/polyline.js";

const mockRedis = vi.mocked(redis);
const mockPlacesRedis = vi.mocked(placesRedis);
const mutableConfig = config as { AMAP_WEB_SERVICE_KEY: string };

/** Answers fetch by endpoint path; unknown paths fail the test. */
function respondByPath(bodies: Record<string, unknown | unknown[]>) {
  const queues = new Map(
    Object.entries(bodies).map(([path, body]) => [path, Array.isArray(body) ? [...body] : [body]])
  );
  vi.mocked(fetch).mockImplementation((input) => {
    const url = new URL(String(input));
    const queue = queues.get(url.pathname);
    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected AMap request: ${url.pathname}`);
    }
    const body = queue.length > 1 ? queue.shift() : queue[0];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

/** Query parameters of the nth fetch call. */
function requestParams(call = 0): URLSearchParams {
  return new URL(String(vi.mocked(fetch).mock.calls[call]?.[0])).searchParams;
}

const OK = { status: "1", info: "OK", infocode: "10000" };

/** GCJ-02 location string AMap would return for a WGS-84 point. */
function gcjString(point: { lat: number; lng: number }): string {
  const gcj = wgs84ToGcj02(point);
  return `${gcj.lng.toFixed(6)},${gcj.lat.toFixed(6)}`;
}

const SANLITUN = { lat: 39.9334, lng: 116.4479 };
const GUOMAO = { lat: 39.9087, lng: 116.4607 };

function expectNear(actual: { lat: number; lng: number }, expected: { lat: number; lng: number }) {
  expect(actual.lat).toBeCloseTo(expected.lat, 5);
  expect(actual.lng).toBeCloseTo(expected.lng, 5);
}

describe("AMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableConfig.AMAP_WEB_SERVICE_KEY = "test-amap-key";
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockPlacesRedis.get.mockResolvedValue(null);
    mockPlacesRedis.set.mockResolvedValue("OK");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("statusForInfocode", () => {
    it("maps infocodes to the statuses services handle", () => {
      expect(statusForInfocode("10004")).toBe("OVER_QUERY_LIMIT");
      expect(statusForInfocode("10021")).toBe("OVER_QUERY_LIMIT");
      expect(statusForInfocode("10003")).toBe("OVER_DAILY_LIMIT");
      expect(statusForInfocode("10001")).toBe("REQUEST_DENIED");
      expect(statusForInfocode("20000")).toBe("INVALID_REQUEST");
      expect(statusForInfocode("20802")).toBe("ZERO_RESULTS");
      expect(statusForInfocode("99999")).toBe("UNKNOWN_ERROR");
      expect(statusForInfocode(undefined)).toBe("UNKNOWN_ERROR");
    });
  });

  describe("parse helpers", () => {
    it("treats AMap's empty arrays as empty strings", () => {
      expect(text([])).toBe("");
      expect(text(undefined)).toBe("");
      expect(text("朝阳区")).toBe("朝阳区");
    });

    it("sends GCJ-02 lng,lat and reads it back as WGS-84", () => {
      const sent = toAmapLocation(SANLITUN);
      expect(sent).toBe(gcjString(SANLITUN));
      const back = fromAmapLocation(sent);
      expect(back).not.toBeNull();
      expectNear(back!, SANLITUN);
    });

    it("rejects empty or malformed locations", () => {
      expect(fromAmapLocation([])).toBeNull();
      expect(fromAmapLocation("")).toBeNull();
      expect(fromAmapLocation("116.4")).toBeNull();
      expect(fromAmapLocation("abc,def")).toBeNull();
    });

    it("parses plain and wrapped polylines", () => {
      const raw = `${gcjString(SANLITUN)};${gcjString(GUOMAO)}`;
      expect(fromAmapPolyline(raw)).toHaveLength(2);
      expect(fromAmapPolyline({ polyline: raw })).toHaveLength(2);
      expect(fromAmapPolyline(undefined)).toEqual([]);
    });

    it("recognizes AMap venue IDs", () => {
      expect(isAmapVenueId("amap:B000A7BM4H")).toBe(true);
      expect(isAmapVenueId("ChIJ123")).toBe(false);
    });

    it("maps AMap type codes to Google place types", () => {
      expect(googleTypesForTypecode("050501")).toEqual(["cafe", "point_of_interest"]);
      expect(googleTypesForTypecode("050101")).toEqual(["restaurant", "point_of_interest"]);
      expect(googleTypesForTypecode("080304")).toEqual(["bar", "point_of_interest"]);
      expect(googleTypesForTypecode("110101|060101")).toEqual(["park", "point_of_interest"]);
      expect(googleTypesForTypecode("999999")).toEqual(["point_of_interest"]);
    });
  });

  describe("amapGeocode", () => {
    it("returns WGS-84 coordinates for a precise match", async () => {
      respondByPath({
        "/v3/geocode/geo": {
          ...OK,
          geocodes: [
            {
              formatted_address: "北京市朝阳区三里屯路19号",
              location: gcjString(SANLITUN),
              level: "门址",
            },
          ],
        },
      });

      const result = await amapGeocode("北京市朝阳区三里屯路19号");

      expectNear(result, SANLITUN);
      expect(result.formattedAddress).toBe("北京市朝阳区三里屯路19号");
      expect(requestParams().get("key")).toBe("test-amap-key");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "amap:geocode:北京市朝阳区三里屯路19号",
        expect.any(String),
        "EX",
        2592000
      );
    });

    it("looks a place name up as a POI when the geocoder only finds a district", async () => {
      respondByPath({
        "/v3/geocode/geo": {
          ...OK,
          geocodes: [{ location: "116.443108,39.921470", level: "区县" }],
        },
        "/v5/place/text": {
          ...OK,
          pois: [
            {
              id: "B000A9KXWR",
              name: "三里屯太古里",
              location: gcjString(SANLITUN),
              cityname: "北京市",
              adname: "朝阳区",
              address: "三里屯路19号",
            },
          ],
        },
      });

      const result = await amapGeocode("三里屯太古里");

      expectNear(result, SANLITUN);
      expect(result.formattedAddress).toBe("北京市朝阳区三里屯路19号 三里屯太古里");
    });

    it("throws AddressNotFoundError when nothing matches", async () => {
      respondByPath({
        "/v3/geocode/geo": { ...OK, geocodes: [] },
        "/v5/place/text": { ...OK, pois: [] },
      });

      await expect(amapGeocode("nowhere at all")).rejects.toBeInstanceOf(AddressNotFoundError);
    });

    it("does not retry an invalid key", async () => {
      respondByPath({
        "/v3/geocode/geo": { status: "0", info: "INVALID_USER_KEY", infocode: "10001" },
      });

      const error = await amapGeocode("北京").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(GeocodingApiError);
      expect((error as GeocodingApiError).status).toBe("REQUEST_DENIED");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("retries rate limits", async () => {
      respondByPath({
        "/v3/geocode/geo": [
          { status: "0", info: "ACCESS_TOO_FREQUENT", infocode: "10004" },
          { ...OK, geocodes: [{ location: gcjString(SANLITUN), level: "门址" }] },
        ],
      });

      const result = await amapGeocode("北京市朝阳区三里屯路19号");

      expectNear(result, SANLITUN);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("fails without calling AMap when no key is configured", async () => {
      mutableConfig.AMAP_WEB_SERVICE_KEY = "";

      const error = await amapGeocode("北京").catch((e: unknown) => e);

      expect((error as GeocodingApiError).status).toBe("REQUEST_DENIED");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("amapReverseGeocode", () => {
    it("returns the address and city code for a point", async () => {
      respondByPath({
        "/v3/geocode/regeo": {
          ...OK,
          regeocode: {
            formatted_address: "北京市朝阳区三里屯街道三里屯路19号",
            addressComponent: { citycode: "010", city: [] },
          },
        },
      });

      const result = await amapReverseGeocode(SANLITUN);

      expect(result).toEqual({
        formattedAddress: "北京市朝阳区三里屯街道三里屯路19号",
        cityCode: "010",
      });
      expect(requestParams().get("location")).toBe(gcjString(SANLITUN));
    });

    it("throws AddressNotFoundError when AMap has no address", async () => {
      respondByPath({ "/v3/geocode/regeo": { ...OK, regeocode: { formatted_address: [] } } });

      await expect(amapReverseGeocode(SANLITUN)).rejects.toBeInstanceOf(AddressNotFoundError);
    });
  });

  describe("amapSuggest", () => {
    it("biases to the city around a point and drops tips without a location", async () => {
      respondByPath({
        "/v3/geocode/regeo": {
          ...OK,
          regeocode: { formatted_address: "北京市朝阳区", addressComponent: { citycode: "010" } },
        },
        "/v3/assistant/inputtips": {
          ...OK,
          tips: [
            {
              id: "B000A9KXWR",
              name: "三里屯太古里",
              district: "北京市朝阳区",
              address: "三里屯路19号",
              location: gcjString(SANLITUN),
            },
            { id: [], name: "三里屯", district: [], address: [], location: [] },
          ],
        },
      });

      const suggestions = await amapSuggest("三里屯", GUOMAO);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.placeId).toBe("amap:B000A9KXWR");
      expectNear(suggestions[0]!.location, SANLITUN);
      const tipsParams = requestParams(1);
      expect(tipsParams.get("city")).toBe("010");
      expect(tipsParams.get("location")).toBe(gcjString(GUOMAO));
      expect(tipsParams.get("datatype")).toBe("poi");
    });
  });

  describe("places", () => {
    const cafePoi = {
      id: "B0FFXXXXXX",
      name: "星巴克(三里屯店)",
      location: gcjString(SANLITUN),
      typecode: "050501",
      cityname: "北京市",
      adname: "朝阳区",
      address: "三里屯路19号",
      business: { rating: "4.5", cost: "38.00", tel: "010-12345678", opentime_week: "周一至周日 07:00-22:00" },
      photos: [{ title: [], url: "http://store.is.autonavi.com/showpic/abc" }],
    };

    it("searches a category nearby and normalizes POIs", async () => {
      respondByPath({ "/v5/place/around": { ...OK, pois: [cafePoi] } });

      const [place] = await amapSearchNearby(GUOMAO, 3000, "cafe");

      expect(place).toMatchObject({
        placeId: "amap:B0FFXXXXXX",
        name: "星巴克(三里屯店)",
        address: "三里屯路19号",
        types: ["cafe", "point_of_interest"],
        rating: 4.5,
        priceLevel: 1,
        openNow: null,
        photoReference: "https://store.is.autonavi.com/showpic/abc",
      });
      expectNear(place!.location, SANLITUN);
      const params = requestParams();
      expect(params.get("types")).toBe("050500");
      expect(params.get("radius")).toBe("3000");
      expect(params.get("location")).toBe(gcjString(GUOMAO));
      expect(params.get("show_fields")).toBe("business,photos");
    });

    it("keeps AMap and Google search caches apart", async () => {
      respondByPath({ "/v5/place/around": { ...OK, pois: [] } });

      await amapSearchNearby(GUOMAO, 3000, "cafe");

      expect(mockPlacesRedis.get).toHaveBeenCalledWith(expect.stringMatching(/^amap:places:search:/));
    });

    it("searches keywords inside the radius", async () => {
      respondByPath({ "/v5/place/around": { ...OK, pois: [cafePoi] } });

      const results = await amapTextSearch("咖啡", GUOMAO, 2000);

      expect(results).toHaveLength(1);
      expect(requestParams().get("keywords")).toBe("咖啡");
    });

    it("returns details with phone and hours", async () => {
      respondByPath({ "/v5/place/detail": { ...OK, pois: [cafePoi] } });

      const details = await amapGetDetails("amap:B0FFXXXXXX");

      expect(details.formattedPhoneNumber).toBe("010-12345678");
      expect(details.openingHours).toEqual(["周一至周日 07:00-22:00"]);
      expect(requestParams().get("id")).toBe("B0FFXXXXXX");
    });

    it("reports a missing POI as NOT_FOUND", async () => {
      respondByPath({ "/v5/place/detail": { ...OK, pois: [] } });

      const error = await amapGetDetails("amap:B0FFXXXXXX").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PlacesApiError);
      expect((error as PlacesApiError).status).toBe("NOT_FOUND");
    });

    it("rejects ID lists without calling AMap", async () => {
      const error = await amapGetDetails("amap:B0FF|B0FG").catch((e: unknown) => e);

      expect((error as PlacesApiError).status).toBe("INVALID_REQUEST");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("routes", () => {
    const midpoint = { lat: 39.92, lng: 116.455 };

    it("builds a driving route from its steps", async () => {
      respondByPath({
        "/v5/direction/driving": {
          ...OK,
          route: {
            paths: [
              {
                distance: "3200",
                cost: { duration: "720" },
                steps: [
                  { polyline: `${gcjString(SANLITUN)};${gcjString(midpoint)}` },
                  { polyline: `${gcjString(midpoint)};${gcjString(GUOMAO)}` },
                ],
              },
            ],
          },
        },
      });

      const route = await amapCalculateRoute(SANLITUN, GUOMAO, "driving", "p1");

      expect(route.participantId).toBe("p1");
      expect(route.distance).toEqual({ value: 3200, text: "3.2 km" });
      expect(route.duration).toEqual({ value: 720, text: "12 mins" });
      const expectedPath = [SANLITUN, midpoint, midpoint, GUOMAO].map((p) =>
        gcj02ToWgs84(wgs84ToGcj02(p))
      );
      expect(route.polyline).toBe(encodePolyline(expectedPath));
      expect(requestParams().get("show_fields")).toBe("cost,polyline");
    });

    it("sums step durations when the path has none", async () => {
      respondByPath({
        "/v5/direction/walking": {
          ...OK,
          route: {
            paths: [
              {
                distance: "800",
                steps: [{ cost: { duration: "300" } }, { cost: { duration: "240" } }],
              },
            ],
          },
        },
      });

      const route = await amapCalculateRoute(SANLITUN, GUOMAO, "walking", "p1");

      expect(route.duration?.value).toBe(540);
      expect(route.distance?.text).toBe("800 m");
    });

    it("plans transit with both cities and joins every leg", async () => {
      respondByPath({
        "/v3/geocode/regeo": {
          ...OK,
          regeocode: { formatted_address: "北京市朝阳区", addressComponent: { citycode: "010" } },
        },
        "/v5/direction/transit/integrated": {
          ...OK,
          route: {
            transits: [
              {
                distance: "5100",
                cost: { duration: "1800" },
                segments: [
                  { walking: { steps: [{ polyline: { polyline: gcjString(SANLITUN) } }] } },
                  { bus: { buslines: [{ polyline: { polyline: gcjString(midpoint) } }] } },
                  {
                    railway: {
                      departure_stop: { location: gcjString(midpoint) },
                      arrival_stop: { location: gcjString(GUOMAO) },
                    },
                  },
                ],
              },
            ],
          },
        },
      });

      const route = await amapCalculateRoute(SANLITUN, GUOMAO, "transit", "p1");

      expect(route.duration?.value).toBe(1800);
      const transitCall = vi
        .mocked(fetch)
        .mock.calls.map(([input]) => new URL(String(input)))
        .find((url) => url.pathname === "/v5/direction/transit/integrated");
      expect(transitCall?.searchParams.get("city1")).toBe("010");
      expect(transitCall?.searchParams.get("city2")).toBe("010");
      const expectedPath = [SANLITUN, midpoint, midpoint, GUOMAO].map((p) =>
        gcj02ToWgs84(wgs84ToGcj02(p))
      );
      expect(route.polyline).toBe(encodePolyline(expectedPath));
    });

    it("reports an unreachable destination as ZERO_RESULTS without retrying", async () => {
      respondByPath({
        "/v5/direction/driving": { status: "0", info: "ROUTE_FAIL", infocode: "20802" },
      });

      const error = await amapCalculateRoute(SANLITUN, GUOMAO, "driving", "p1").catch(
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(DirectionsApiError);
      expect((error as DirectionsApiError).status).toBe("ZERO_RESULTS");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("leaves failed participants out of a batch", async () => {
      respondByPath({
        "/v5/direction/driving": [
          { ...OK, route: { paths: [{ distance: "1000", cost: { duration: "120" }, steps: [] }] } },
          { status: "0", info: "NO_ROADS_NEARBY", infocode: "20801" },
        ],
      });

      const routes = await amapCalculateBatchRoutes(
        [
          { id: "p1", ...SANLITUN },
          { id: "p2", ...midpoint },
        ],
        GUOMAO,
        "driving"
      );

      expect(routes.map((r) => r.participantId)).toEqual(["p1"]);
    });
  });
});
