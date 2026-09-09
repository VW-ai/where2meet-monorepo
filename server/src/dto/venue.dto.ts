/**
 * Venue DTO interfaces and schemas.
 * @module dto/venue
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * Venue data in API response (summary).
 */
export const VenueResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  location: LocationResponseSchema,
  types: z.array(z.string()),
  rating: z.number().nullable(),
  userRatingsTotal: z.number().nullable(),
  priceLevel: z.number().nullable(),
  openNow: z.boolean().nullable(),
  photoUrl: z.string().nullable(),
});

export type VenueResponse = z.infer<typeof VenueResponseSchema>;

/**
 * Detailed venue data in API response.
 */
export const VenueDetailsResponseSchema = VenueResponseSchema.extend({
  formattedPhoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  openingHours: z.array(z.string()).nullable(),
});

export type VenueDetailsResponse = z.infer<typeof VenueDetailsResponseSchema>;

/**
 * Response for venue search operation.
 */
export const VenueSearchResponseSchema = z.object({
  venues: z.array(VenueResponseSchema),
  totalResults: z.number(),
  searchCenter: LocationResponseSchema,
});

export type VenueSearchResponse = z.infer<typeof VenueSearchResponseSchema>;
