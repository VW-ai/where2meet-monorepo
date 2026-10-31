/**
 * AMap POI search 2.0: nearby search, keyword search and details.
 *
 * Results are normalized to the Google-shaped PlaceResult / PlaceDetails with
 * WGS-84 coordinates and "amap:" venue IDs. AMap's search quota is small
 * (5,000 calls a month on a personal key), so every result is cached.
 * @see https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch
 * @module lib/amap/places
 */

import {
  getSearchCacheKey,
  getCachedSearch,
  cacheSearchResults,
  getCachedDetails,
  cacheDetails,
} from "../places/cache.js";
import { PlacesApiError } from "../places/errors.js";
import type { GeoPoint, PlaceDetails, PlaceResult, VenueCategory } from "../places/types.js";
import { CATEGORY_TO_AMAP_TYPES, googleTypesForTypecode } from "./categories.js";
import { amapGet, withAmapRetry } from "./client.js";
import { fromAmapLocation, fromAmapVenueId, text, toAmapLocation, toAmapVenueId } from "./parse.js";
import type { AmapPoi, AmapPoiResponse } from "./types.js";

/** The largest page AMap serves; one call per search keeps quota use down. */
const PAGE_SIZE = "25";

/** Adds rating, cost, phone, hours and photos to each POI. */
const SHOW_FIELDS = "business,photos";

/** AMap keyword search accepts at most 80 characters. */
const MAX_KEYWORD_LENGTH = 80;

/** AMap POI IDs, e.g. "B000A7BM4H". */
const POI_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;

const placesError = (message: string, status: string) => new PlacesApiError(message, status);

/**
 * Maps average spend per person (CNY) to Google's 1-4 price level so the
 * client's "$$" display works for AMap venues.
 */
function priceLevelForCost(cost: string | undefined): number | null {
  const yuan = Number(cost);
  if (!cost || !Number.isFinite(yuan) || yuan <= 0) return null;
  if (yuan < 50) return 1;
  if (yuan < 120) return 2;
  if (yuan < 300) return 3;
  return 4;
}

function parseRating(rating: string | undefined): number | null {
  const value = Number(rating);
  return rating && Number.isFinite(value) && value > 0 ? value : null;
}

/** First photo URL. Served over HTTPS so it loads on the HTTPS site. */
function firstPhotoUrl(poi: AmapPoi): string | null {
  const url = poi.photos?.find((photo) => photo.url)?.url;
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

/**
 * Normalizes an AMap POI.
 * @param poi - Raw POI
 * @returns PlaceDetails (a PlaceResult plus contact fields), or null without a location
 */
export function parseAmapPoi(poi: AmapPoi): PlaceDetails | null {
  const location = fromAmapLocation(poi.location);
  if (!location) {
    return null;
  }
  const hours = text(poi.business?.opentime_week);
  return {
    placeId: toAmapVenueId(poi.id),
    name: poi.name,
    address: text(poi.address) || `${text(poi.cityname)}${text(poi.adname)}`,
    location,
    types: googleTypesForTypecode(poi.typecode),
    rating: parseRating(poi.business?.rating),
    // AMap does not expose review counts or live open status.
    userRatingsTotal: null,
    priceLevel: priceLevelForCost(poi.business?.cost),
    openNow: null,
    photoReference: firstPhotoUrl(poi),
    formattedPhoneNumber: text(poi.business?.tel) || null,
    website: null,
    openingHours: hours ? [hours] : null,
  };
}

/** Normalizes a POI list, dropping entries without a location. */
function parsePois(response: AmapPoiResponse): PlaceDetails[] {
  return (response.pois ?? [])
    .map(parseAmapPoi)
    .filter((place): place is PlaceDetails => place !== null);
}

/** Runs a cached /v5/place/around query. */
async function searchAround(
  cacheKey: string,
  center: GeoPoint,
  radiusMeters: number,
  filter: { types: string } | { keywords: string },
  sortrule: "weight" | "distance"
): Promise<PlaceResult[]> {
  const cached = await getCachedSearch(cacheKey);
  if (cached) {
    return cached;
  }
  const results = await withAmapRetry(async () => {
    const response = await amapGet<AmapPoiResponse>(
      "/v5/place/around",
      {
        location: toAmapLocation(center),
        radius: String(radiusMeters),
        ...filter,
        sortrule,
        page_size: PAGE_SIZE,
        show_fields: SHOW_FIELDS,
      },
      placesError
    );
    return parsePois(response);
  });
  await cacheSearchResults(cacheKey, results);
  return results;
}

/**
 * Searches one category near a point, most prominent first.
 * @param center - WGS-84 search center
 * @param radiusMeters - Radius in meters (AMap maximum 50000)
 * @param category - Where2Meet venue category
 * @returns Normalized places
 * @throws PlacesApiError on API errors
 */
export async function amapSearchNearby(
  center: GeoPoint,
  radiusMeters: number,
  category: VenueCategory
): Promise<PlaceResult[]> {
  const cacheKey = `amap:${getSearchCacheKey(center, radiusMeters, category, null)}`;
  return searchAround(
    cacheKey,
    center,
    radiusMeters,
    { types: CATEGORY_TO_AMAP_TYPES[category] },
    "weight"
  );
}

/**
 * Searches a keyword inside the radius.
 *
 * Uses nearby search with keywords rather than /v5/place/text, which can only
 * bias results to a whole city.
 * @param query - Search text, e.g. "火锅" or "Starbucks"
 * @param center - WGS-84 search center
 * @param radiusMeters - Radius in meters
 * @returns Normalized places
 * @throws PlacesApiError on API errors
 */
export async function amapTextSearch(
  query: string,
  center: GeoPoint,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const cacheKey = `amap:${getSearchCacheKey(center, radiusMeters, null, query)}`;
  return searchAround(
    cacheKey,
    center,
    radiusMeters,
    { keywords: query.slice(0, MAX_KEYWORD_LENGTH) },
    // AMap ignores sortrule for keyword-only searches; weight states the intent.
    "weight"
  );
}

/**
 * Gets details for an AMap venue.
 * @param venueId - "amap:<POI id>"
 * @returns Normalized details
 * @throws PlacesApiError with status NOT_FOUND if the POI does not exist
 */
export async function amapGetDetails(venueId: string): Promise<PlaceDetails> {
  // AMap accepts "|"-joined ID lists here, so only a single plain ID may pass through.
  if (!POI_ID_PATTERN.test(fromAmapVenueId(venueId))) {
    throw new PlacesApiError(`Invalid AMap venue ID: ${venueId}`, "INVALID_REQUEST");
  }
  const cached = await getCachedDetails(venueId);
  if (cached) {
    return cached;
  }
  const details = await withAmapRetry(async () => {
    const response = await amapGet<AmapPoiResponse>(
      "/v5/place/detail",
      { id: fromAmapVenueId(venueId), show_fields: SHOW_FIELDS },
      placesError
    );
    const place = parsePois(response)[0];
    if (!place) {
      throw new PlacesApiError(`Place not found: ${venueId}`, "NOT_FOUND");
    }
    return place;
  });
  await cacheDetails(venueId, details);
  return details;
}
