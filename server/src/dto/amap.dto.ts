/**
 * AMap lookup DTO schemas.
 * @module dto/amap
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * One autocomplete suggestion. placeId is a venue ID ("amap:<POI id>").
 */
export const AmapSuggestionResponseSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  district: z.string(),
  address: z.string(),
  location: LocationResponseSchema,
});

export const AmapSuggestResponseSchema = z.object({
  suggestions: z.array(AmapSuggestionResponseSchema),
});

export type AmapSuggestResponse = z.infer<typeof AmapSuggestResponseSchema>;

/**
 * Address for a point, in WGS-84 like every other API location.
 */
export const AmapReverseGeocodeResponseSchema = z.object({
  formattedAddress: z.string(),
  location: LocationResponseSchema,
});

export type AmapReverseGeocodeResponse = z.infer<typeof AmapReverseGeocodeResponseSchema>;
