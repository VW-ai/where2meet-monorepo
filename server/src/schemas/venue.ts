/**
 * Venue validation schemas (Request DTOs).
 *
 * Zod schemas for validating venue-related API requests.
 * Response DTOs are defined in dto/.
 * @module schemas/venue
 */

import { z } from "zod";
import { CATEGORY_TO_PLACE_TYPE } from "../lib/places/index.js";

/** Valid venue category values */
const validCategories = Object.keys(CATEGORY_TO_PLACE_TYPE) as [string, ...string[]];

/**
 * Schema for geographic center point.
 */
const CenterSchema = z.object({
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

/**
 * Schema for searching venues.
 * Requires center (user-provided search location) and searchRadius.
 * At least one of query or categories must be provided.
 */
export const SearchVenuesSchema = z
  .object({
    center: CenterSchema,
    searchRadius: z
      .number()
      .min(100, "Search radius must be at least 100 meters")
      .max(50000, "Search radius cannot exceed 50,000 meters")
      .transform((val) => Math.round(val)),
    query: z
      .string()
      .min(1, "Query cannot be empty")
      .max(100, "Query must be 100 characters or less")
      .optional(),
    categories: z
      .array(z.enum(validCategories))
      .min(1, "At least one category required")
      .optional(),
  })
  .refine((data) => data.query !== undefined || data.categories !== undefined, {
    message: "At least one of query or categories must be provided",
  });

export type SearchVenuesInput = z.infer<typeof SearchVenuesSchema>;

/**
 * Schema for validating venue ID (Google Place ID).
 */
export const VenueIdSchema = z.object({
  id: z.string().min(1, "Venue ID is required"),
});

export type VenueIdParam = z.infer<typeof VenueIdSchema>;
