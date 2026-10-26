/**
 * AMap lookup mapper module.
 * @module mappers/amap
 */

import type { AmapSuggestion } from "../lib/amap/index.js";
import type { LatLng } from "../lib/geo/coords.js";
import {
  AmapSuggestResponseSchema,
  AmapReverseGeocodeResponseSchema,
  type AmapSuggestResponse,
  type AmapReverseGeocodeResponse,
} from "../dto/amap.dto.js";

/**
 * Transforms suggestions to the response DTO.
 */
export function toAmapSuggestResponse(suggestions: AmapSuggestion[]): AmapSuggestResponse {
  return AmapSuggestResponseSchema.parse({ suggestions });
}

/**
 * Transforms a reverse geocode result to the response DTO.
 */
export function toAmapReverseGeocodeResponse(
  formattedAddress: string,
  location: LatLng
): AmapReverseGeocodeResponse {
  return AmapReverseGeocodeResponseSchema.parse({ formattedAddress, location });
}
