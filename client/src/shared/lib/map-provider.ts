/**
 * Place lookups for either map provider.
 *
 * Google events call Google from the browser. AMap events go through the
 * server (/api/amap/*), because Google is blocked in mainland China and the
 * AMap Web Service key must stay private.
 */

import { amapApi, type AmapSuggestion } from '@/lib/api/amap';
import { reverseGeocode } from '@/shared/lib/google-maps/geocoding';
import {
  searchPlacesAutocomplete,
  type PlacePrediction,
} from '@/shared/lib/google-maps/places-autocomplete';
import type { Location, MapProvider } from '@/shared/types/map';

/** AMap's input tips accept at most 80 characters. */
const AMAP_MAX_QUERY_LENGTH = 80;

/** IANA zones for mainland China. Hong Kong and Macau use Google. */
const MAINLAND_CHINA_TIME_ZONES = new Set([
  'Asia/Shanghai',
  'Asia/Urumqi',
  'Asia/Chongqing',
  'Asia/Chungking',
  'Asia/Harbin',
  'Asia/Kashgar',
  'PRC',
]);

/** Whether a browser in this time zone is probably in mainland China. */
export function isMainlandChinaTimeZone(timeZone: string | undefined): boolean {
  return !!timeZone && MAINLAND_CHINA_TIME_ZONES.has(timeZone);
}

export function toPlacePrediction(suggestion: AmapSuggestion): PlacePrediction {
  const secondary = `${suggestion.district}${suggestion.address}`;
  return {
    place_id: suggestion.placeId,
    description: suggestion.name,
    main_text: suggestion.name,
    secondary_text: secondary,
    // The server geocodes this text with AMap, so keep the place name in it
    full_address: secondary ? `${secondary}${suggestion.name}` : suggestion.name,
  };
}

/**
 * Suggestions for typed text.
 * @param options.near - Prefer results around this point
 * @param options.establishmentsOnly - Google only: businesses, not addresses
 */
export async function searchPlaceSuggestions(
  provider: MapProvider,
  query: string,
  options: { near?: Location; establishmentsOnly?: boolean } = {}
): Promise<PlacePrediction[]> {
  if (provider === 'amap') {
    const q = query.trim().slice(0, AMAP_MAX_QUERY_LENGTH);
    if (q.length < 2) return [];
    const { suggestions } = await amapApi.suggest(q, options.near);
    return suggestions.map(toPlacePrediction);
  }
  return searchPlacesAutocomplete(query, {
    types: options.establishmentsOnly ? ['establishment'] : undefined,
    location: options.near,
    radius: options.near ? 50000 : undefined,
  });
}

/**
 * Address at a point, for "use my current location".
 * AMap has no place ID for a point, so its placeId is the point itself; forms
 * only use placeId to know that an address was picked rather than typed.
 */
export async function reverseGeocodePoint(
  provider: MapProvider,
  location: Location
): Promise<{ address: string; placeId: string }> {
  if (provider === 'amap') {
    const { formattedAddress } = await amapApi.reverseGeocode(location);
    return { address: formattedAddress, placeId: `${location.lat},${location.lng}` };
  }
  const result = await reverseGeocode(location);
  return { address: result.address, placeId: result.placeId };
}

/** Link that opens a venue in the provider's own map site or app. */
export function venueMapsUrl(
  provider: MapProvider,
  venue: { id: string; name: string; address: string; location: Location }
): string {
  if (provider === 'amap') {
    const params = new URLSearchParams({
      position: `${venue.location.lng},${venue.location.lat}`,
      name: venue.name,
      coordinate: 'wgs84',
      callnative: '1',
      src: 'where2meet',
    });
    return `https://uri.amap.com/marker?${params}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}&query_place_id=${venue.id}`;
}

/** Display name for buttons such as "Open in Google Maps". */
export function mapProviderName(provider: MapProvider): string {
  return provider === 'amap' ? 'Amap' : 'Google Maps';
}
