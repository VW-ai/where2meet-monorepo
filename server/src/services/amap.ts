/**
 * AMap lookup service.
 *
 * Autocomplete and reverse geocoding for China events, which cannot use
 * Google in the browser. Converts AMap errors to API errors.
 * @module services/amap
 */

import {
  amapSuggest,
  amapReverseGeocode,
  type AmapSuggestion,
  type AmapReverseGeocodeResult,
} from "../lib/amap/index.js";
import type { LatLng } from "../lib/geo/coords.js";
import { AddressNotFoundError, GeocodingApiError } from "../lib/maps.js";
import { PlacesApiError } from "../lib/places/index.js";
import {
  AddressNotFoundError as BusinessAddressNotFoundError,
  ExternalServiceError,
} from "../types/errors.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("AmapService");

/**
 * Suggests places for a partial query.
 * @param query - Text typed so far
 * @param near - Optional WGS-84 point to prefer results around
 * @returns Suggestions with venue IDs and WGS-84 locations
 * @throws ExternalServiceError if AMap fails
 */
export async function suggestPlaces(query: string, near?: LatLng): Promise<AmapSuggestion[]> {
  try {
    return await amapSuggest(query, near);
  } catch (error) {
    if (error instanceof PlacesApiError) {
      logger.error({ err: error }, "AMap input tips error");
      throw new ExternalServiceError("AMap", error.message);
    }
    throw error;
  }
}

/**
 * Finds the address at a point.
 * @param point - WGS-84 coordinates
 * @returns Formatted address and city code
 * @throws BusinessAddressNotFoundError if AMap has no address there
 * @throws ExternalServiceError if AMap fails
 */
export async function reverseGeocodePoint(point: LatLng): Promise<AmapReverseGeocodeResult> {
  try {
    return await amapReverseGeocode(point);
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      throw new BusinessAddressNotFoundError();
    }
    if (error instanceof GeocodingApiError) {
      logger.error({ err: error }, "AMap reverse geocoding error");
      throw new ExternalServiceError("AMap", error.message);
    }
    throw error;
  }
}
