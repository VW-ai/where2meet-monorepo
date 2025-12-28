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
  voteId: z.uuid(),
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
  voters: z.array(z.uuid()),
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
  deleted: z.boolean(),
});

export type VoteRemovalResponse = z.infer<typeof VoteRemovalResponseSchema>;

/**
 * Response for vote statistics snapshot with sequence number.
 * Used by GET /api/events/:id/votes/statistics endpoint.
 */
export const VoteStatisticsSnapshotResponseSchema = z.object({
  eventId: z.string(),
  seq: z.number(),
  venues: z.array(
    z.object({
      venueId: z.string(),
      voteCount: z.number(),
      voterIds: z.array(z.uuid()),
    })
  ),
  totalVotes: z.number(),
  updatedAt: z.string(),
});

export type VoteStatisticsSnapshotResponse = z.infer<typeof VoteStatisticsSnapshotResponseSchema>;
