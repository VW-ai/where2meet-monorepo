/**
 * AMap input tips (autocomplete) for China events.
 *
 * Runs on the server so the Web Service key never reaches the browser, and so
 * suggestions can be cached: they share AMap's small search quota.
 * @see https://lbs.amap.com/api/webservice/guide/api-advanced/inputtips
 * @module lib/amap/suggest
 */

import { config } from "../config.js";
import type { LatLng } from "../geo/coords.js";
import { PlacesApiError } from "../places/errors.js";
import { readAmapCache, writeAmapCache } from "./cache.js";
import { amapGet, withAmapRetry } from "./client.js";
import { amapReverseGeocode } from "./geocode.js";
import { fromAmapLocation, text, toAmapLocation, toAmapVenueId } from "./parse.js";
import type { AmapInputTipsResponse } from "./types.js";

/** One autocomplete suggestion. */
export interface AmapSuggestion {
  /** "amap:<POI id>", usable as a venue ID. */
  placeId: string;
  name: string;
  /** Province, city and district, e.g. "北京市朝阳区". */
  district: string;
  address: string;
  location: LatLng;
}

const placesError = (message: string, status: string) => new PlacesApiError(message, status);

/**
 * AMap only applies the location bias when a city is given, so the city is
 * looked up from the point. Failing that, suggestions are simply nationwide.
 */
async function cityCodeNear(near: LatLng): Promise<string | null> {
  try {
    return (await amapReverseGeocode(near)).cityCode;
  } catch {
    return null;
  }
}

/**
 * Suggests places for a partial query.
 * @param query - What the person has typed so far
 * @param near - Optional WGS-84 point to prefer results around
 * @returns Suggestions with a POI ID and location; bus lines and bare keywords are dropped
 * @throws PlacesApiError on API errors
 */
export async function amapSuggest(query: string, near?: LatLng): Promise<AmapSuggestion[]> {
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : "any";
  const cacheKey = `suggest:${nearKey}:${query.toLowerCase().trim()}`;
  const cached = await readAmapCache<AmapSuggestion[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const params: Record<string, string> = { keywords: query, datatype: "poi" };
  if (near) {
    const cityCode = await cityCodeNear(near);
    if (cityCode) {
      params.city = cityCode;
      params.location = toAmapLocation(near);
    }
  }

  const suggestions = await withAmapRetry(async () => {
    const response = await amapGet<AmapInputTipsResponse>(
      "/v3/assistant/inputtips",
      params,
      placesError
    );
    return (response.tips ?? []).flatMap((tip): AmapSuggestion[] => {
      const id = text(tip.id);
      const location = fromAmapLocation(tip.location);
      if (!id || !location) {
        return [];
      }
      return [
        {
          placeId: toAmapVenueId(id),
          name: tip.name,
          district: text(tip.district),
          address: text(tip.address),
          location,
        },
      ];
    });
  });
  void writeAmapCache(cacheKey, suggestions, config.PLACES_SEARCH_CACHE_TTL_SECONDS);
  return suggestions;
}
