/**
 * Vote mapper module.
 *
 * Transforms database entities to Response DTOs with runtime validation.
 * Centralizes all transformation logic for Vote entities and statistics.
 * @module mappers/vote
 */

import type { Vote, Venue } from "@prisma/client";
import type { VoteStats } from "../repositories/vote.js";
import type { VoteStatisticsPayload } from "../types/sse.js";
import {
  VoteResponseSchema,
  VenueWithVotesSchema,
  VoteStatisticsResponseSchema,
  VoteRemovalResponseSchema,
  type VoteResponse,
  type VenueWithVotes,
  type VoteStatisticsResponse,
  type VoteRemovalResponse,
} from "../dto/vote.dto.js";

/**
 * Transforms a Vote entity to VoteResponse DTO.
 * Used after successfully casting a vote.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVoteResponse(entity: Vote): VoteResponse {
  const response = {
    success: true,
    voteId: entity.id,
  };

  return VoteResponseSchema.parse(response);
}

/**
 * Transforms a Venue entity with vote statistics to VenueWithVotes DTO.
 * Includes all venue fields plus vote aggregation data.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVenueWithVotesResponse(
  venue: Venue,
  voteCount: number,
  voterIds: string[]
): VenueWithVotes {
  const response = {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    location: {
      lat: Number(venue.lat),
      lng: Number(venue.lng),
    },
    category: venue.category,
    rating: venue.rating ? Number(venue.rating) : null,
    priceLevel: venue.priceLevel,
    photoUrl: venue.photoUrl,
    voteCount,
    voters: voterIds,
  };

  return VenueWithVotesSchema.parse(response);
}

/**
 * Transforms vote statistics array to VoteStatisticsResponse DTO.
 * Aggregates all votes for an event grouped by venue.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVoteStatisticsResponse(stats: VoteStats[]): VoteStatisticsResponse {
  const venues = stats.map((stat) =>
    toVenueWithVotesResponse(stat.venue, stat.voteCount, stat.voterIds)
  );

  const totalVotes = stats.reduce((sum, stat) => sum + stat.voteCount, 0);

  const response = {
    venues,
    totalVotes,
  };

  return VoteStatisticsResponseSchema.parse(response);
}

/**
 * Transforms vote statistics to the vote:statistics SSE payload, a full snapshot of an event's votes.
 * The SSE service sets seq and updatedAt when it broadcasts.
 */
export function toVoteStatisticsPayload(
  eventId: string,
  stats: VoteStats[]
): VoteStatisticsPayload {
  return {
    eventId,
    seq: 0,
    venues: stats.map((stat) => ({
      venueId: stat.venue.id,
      voteCount: stat.voteCount,
      voterIds: stat.voterIds,
      voterNames: stat.voterIds, // DEPRECATED: kept for backward compatibility
    })),
    totalVotes: stats.reduce((sum, stat) => sum + stat.voteCount, 0),
    updatedAt: "",
  };
}

/**
 * Creates a success response for vote removal operation.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVoteRemovalResponse(deleted: boolean): VoteRemovalResponse {
  const response = {
    success: true,
    deleted,
  };

  return VoteRemovalResponseSchema.parse(response);
}
