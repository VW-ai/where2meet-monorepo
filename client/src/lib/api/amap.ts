/**
 * AMap Lookup API
 *
 * Status: BACKEND
 * China events cannot use Google in the browser, so autocomplete and "use my
 * location" go through the server, which calls AMap. Coordinates are WGS-84.
 * Endpoints:
 * - GET /api/amap/suggest - Place suggestions for typed text
 * - GET /api/amap/reverse-geocode - Address at a point
 */

import type { Location } from '@/shared/types/map';
import { backendCall } from './client';

export interface AmapSuggestion {
  placeId: string; // "amap:<POI id>", usable with GET /api/venues/:id
  name: string;
  district: string;
  address: string;
  location: Location;
}

export interface AmapReverseGeocodeResult {
  formattedAddress: string;
  location: Location;
}

export const amapApi = {
  /**
   * Suggest places for typed text (2-80 characters), nearest first when `near` is given
   */
  suggest: (q: string, near?: Location) => {
    const params = new URLSearchParams({ q });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lng', String(near.lng));
    }
    return backendCall<{ suggestions: AmapSuggestion[] }>(`/api/amap/suggest?${params}`);
  },

  /**
   * Address at a point
   */
  reverseGeocode: ({ lat, lng }: Location) =>
    backendCall<AmapReverseGeocodeResult>(
      `/api/amap/reverse-geocode?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`
    ),
};
