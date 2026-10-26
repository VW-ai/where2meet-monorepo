/**
 * AMap geocoding and reverse geocoding.
 * @module lib/amap/geocode
 */

import { config } from "../config.js";
import type { LatLng } from "../geo/coords.js";
import { AddressNotFoundError, GeocodingApiError, type GeocodeResult } from "../maps.js";
import { readAmapCache, writeAmapCache } from "./cache.js";
import { amapGet, withAmapRetry } from "./client.js";
import { fromAmapLocation, text, toAmapLocation } from "./parse.js";
import type { AmapGeocodeResponse, AmapPoiResponse, AmapRegeoResponse } from "./types.js";

/**
 * Geocode levels too coarse to stand for what the person typed. AMap matches a
 * venue name such as "三里屯太古里" to at best its district, so those inputs are
 * looked up as a POI instead.
 */
const COARSE_LEVELS = new Set(["国家", "省", "市", "区县", "开发区", "乡镇", "村庄", "未知"]);

/** AMap keyword search accepts at most 80 characters. */
const MAX_KEYWORD_LENGTH = 80;

const geocodingError = (message: string, status: string) => new GeocodingApiError(message, status);

/** Result of a reverse geocode. */
export interface AmapReverseGeocodeResult {
  formattedAddress: string;
  /** AMap city code (e.g. "010"), required by transit routing. Null if unknown. */
  cityCode: string | null;
}

/** Looks the input up as a place name and returns the best POI. */
async function findPoiByName(address: string): Promise<GeocodeResult | null> {
  const response = await amapGet<AmapPoiResponse>(
    "/v5/place/text",
    { keywords: address.slice(0, MAX_KEYWORD_LENGTH), page_size: "1" },
    geocodingError
  );
  const poi = response.pois?.[0];
  const location = poi ? fromAmapLocation(poi.location) : null;
  if (!poi || !location) {
    return null;
  }
  const area = `${poi.cityname ?? ""}${poi.adname ?? ""}${poi.address ?? ""}`;
  return { ...location, formattedAddress: area ? `${area} ${poi.name}` : poi.name };
}

/** Resolves an address with the geocoder, falling back to a POI search. */
async function resolveAddress(address: string): Promise<GeocodeResult> {
  const response = await amapGet<AmapGeocodeResponse>(
    "/v3/geocode/geo",
    { address },
    geocodingError
  );
  const best = response.geocodes?.[0];
  const location = best ? fromAmapLocation(best.location) : null;
  const geocoded =
    best && location
      ? { ...location, formattedAddress: text(best.formatted_address) || address }
      : null;

  if (geocoded && best && !COARSE_LEVELS.has(text(best.level))) {
    return geocoded;
  }
  const poi = await findPoiByName(address);
  if (poi) {
    return poi;
  }
  if (geocoded) {
    return geocoded;
  }
  throw new AddressNotFoundError();
}

function cacheKeyFor(address: string): string {
  return `geocode:${address.toLowerCase().trim().replace(/\s+/g, " ")}`;
}

/**
 * Geocodes an address to WGS-84 coordinates with caching and retry.
 * @param address - Address or place name, usually in Chinese
 * @returns Coordinates and formatted address
 * @throws AddressNotFoundError if nothing matches
 * @throws GeocodingApiError on API errors
 */
export async function amapGeocode(address: string): Promise<GeocodeResult> {
  const key = cacheKeyFor(address);
  const cached = await readAmapCache<GeocodeResult>(key);
  if (cached) {
    return cached;
  }
  const result = await withAmapRetry(() => resolveAddress(address));
  // Cache in the background; a slow or unavailable cache must not delay the user
  void writeAmapCache(key, result, config.GEOCODE_CACHE_TTL_SECONDS);
  return result;
}

/**
 * Reverse geocodes a WGS-84 point with caching and retry.
 * @param point - WGS-84 coordinates
 * @returns Formatted address and city code
 * @throws AddressNotFoundError if AMap has no address for the point
 * @throws GeocodingApiError on API errors
 */
export async function amapReverseGeocode(point: LatLng): Promise<AmapReverseGeocodeResult> {
  const key = `regeo:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const cached = await readAmapCache<AmapReverseGeocodeResult>(key);
  if (cached) {
    return cached;
  }
  const result = await withAmapRetry(async () => {
    const response = await amapGet<AmapRegeoResponse>(
      "/v3/geocode/regeo",
      { location: toAmapLocation(point) },
      geocodingError
    );
    const formattedAddress = text(response.regeocode?.formatted_address);
    if (!formattedAddress) {
      throw new AddressNotFoundError();
    }
    const cityCode = text(response.regeocode?.addressComponent?.citycode);
    return { formattedAddress, cityCode: cityCode || null };
  });
  void writeAmapCache(key, result, config.GEOCODE_CACHE_TTL_SECONDS);
  return result;
}
