/**
 * Vote DTO interfaces and schemas.
 * @module dto/vote
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * Response for successful vote operation.
 */
export const VoteResponseSchema = z.object({
  success: z.boolean(),
  voteId: z.string().uuid(),
});

export type VoteResponse = z.infer<typeof VoteResponseSchema>;

/**
 * Venue data with vote aggregation.
 * Includes all venue fields plus voting statistics.
 */
export const VenueWithVotesSchema = z.object({
  // Core venue identification
  id: z.string(),
  name: z.string(),

  // Location data
  address: z.string().nullable(),
  location: LocationResponseSchema,

  // Venue attributes
  category: z.string().nullable(),
  rating: z.number().nullable(),
  priceLevel: z.number().nullable(),
  photoUrl: z.string().nullable(),

  // Vote aggregation fields
  voteCount: z.number(),
  voters: z.array(z.string().uuid()),
});

export type VenueWithVotes = z.infer<typeof VenueWithVotesSchema>;

/**
 * Response for vote statistics query.
 */
export const VoteStatisticsResponseSchema = z.object({
  venues: z.array(VenueWithVotesSchema),
  totalVotes: z.number(),
});

export type VoteStatisticsResponse = z.infer<typeof VoteStatisticsResponseSchema>;

/**
 * Response for successful vote removal.
 */
export const VoteRemovalResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type VoteRemovalResponse = z.infer<typeof VoteRemovalResponseSchema>;
