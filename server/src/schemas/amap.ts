/**
 * AMap lookup validation schemas (Request DTOs).
 * @module schemas/amap
 */

import { z } from "zod";

const Latitude = z.coerce.number().min(-90).max(90);
const Longitude = z.coerce.number().min(-180).max(180);

/**
 * Query for GET /api/amap/suggest.
 * lat/lng bias results toward a point and must be sent together.
 */
export const AmapSuggestQuerySchema = z
  .object({
    q: z.string().trim().min(2, "Query must be at least 2 characters").max(80),
    lat: Latitude.optional(),
    lng: Longitude.optional(),
  })
  .refine((data) => (data.lat === undefined) === (data.lng === undefined), {
    message: "lat and lng must be sent together",
  });

export type AmapSuggestQuery = z.infer<typeof AmapSuggestQuerySchema>;

/**
 * Query for GET /api/amap/reverse-geocode.
 */
export const AmapReverseGeocodeQuerySchema = z.object({
  lat: Latitude,
  lng: Longitude,
});

export type AmapReverseGeocodeQuery = z.infer<typeof AmapReverseGeocodeQuerySchema>;
