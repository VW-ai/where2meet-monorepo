/**
 * Vote validation schemas.
 *
 * Zod schemas for validating vote-related request data.
 * @module schemas/vote
 */

import { z } from "zod";

/**
 * Schema for venue data embedded in cast vote requests.
 * Venue data comes from Google Places API and is persisted to the global Venue table.
 */
export const VenueDataSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  address: z.string().optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  rating: z.number().min(0).max(5).optional().nullable(),
  priceLevel: z.number().int().min(0).max(4).optional().nullable(),
  category: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

/**
 * Schema for casting a vote.
 * Request body for POST /api/events/:id/votes
 */
export const CastVoteSchema = z.object({
  participantId: z.string().uuid("Invalid participant ID format"),
  venueId: z.string().min(1, "Venue ID is required"),
  venueData: VenueDataSchema,
});

/**
 * Schema for removing a vote.
 * Request body for DELETE /api/events/:id/votes
 */
export const RemoveVoteSchema = z.object({
  participantId: z.string().uuid("Invalid participant ID format"),
  venueId: z.string().min(1, "Venue ID is required"),
});

/** Inferred type for cast vote request */
export type CastVoteInput = z.infer<typeof CastVoteSchema>;

/** Inferred type for remove vote request */
export type RemoveVoteInput = z.infer<typeof RemoveVoteSchema>;

/** Inferred type for venue data */
export type VenueDataInput = z.infer<typeof VenueDataSchema>;
