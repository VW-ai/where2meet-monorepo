/**
 * Vote repository module.
 *
 * Handles all database operations for Vote entities.
 * Manages the junction table tracking event-participant-venue relationships.
 * @module repositories/vote
 */

import type { PrismaClient, Vote, Venue } from "../generated/prisma/index.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("VoteRepository");

/**
 * Data for creating a new vote in the database.
 */
export interface CreateVoteData {
  eventId: string;
  participantId: string;
  venueId: string;
}

/**
 * Vote with associated venue details.
 */
export interface VoteWithVenue extends Vote {
  venue: Venue;
}

/**
 * Aggregated vote statistics for a venue.
 */
export interface VoteStats {
  venue: Venue;
  voteCount: number;
  voterIds: string[]; // Participant IDs who voted
}

/**
 * Repository for Vote database operations.
 * Manages the junction table for event-participant-venue relationships.
 */
export class VoteRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates a new vote record.
   * The UNIQUE constraint (eventId, participantId, venueId) prevents duplicates.
   * @param data - Vote data
   * @returns Created vote
   * @throws Prisma P2002 error if duplicate vote (handled by service layer)
   */
  async create(data: CreateVoteData): Promise<Vote> {
    logger.debug(
      {
        eventId: data.eventId,
        participantId: data.participantId,
        venueId: data.venueId,
      },
      "Creating vote"
    );

    return this.db.vote.create({
      data: {
        eventId: data.eventId,
        participantId: data.participantId,
        venueId: data.venueId,
      },
    });
  }

  /**
   * Finds all votes for a specific event with venue details.
   * @param eventId - Event ID
   * @returns Array of votes with venue information
   */
  async findByEventId(eventId: string): Promise<VoteWithVenue[]> {
    logger.debug({ eventId }, "Finding votes by event ID");

    return this.db.vote.findMany({
      where: { eventId },
      include: { venue: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Deletes a specific vote by event, participant, and venue.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @param venueId - Venue ID (Google Place ID)
   * @returns Number of deleted records (0 or 1)
   */
  async deleteByEventParticipantVenue(
    eventId: string,
    participantId: string,
    venueId: string
  ): Promise<number> {
    logger.debug(
      { eventId, participantId, venueId },
      "Deleting vote"
    );

    const result = await this.db.vote.deleteMany({
      where: {
        eventId,
        participantId,
        venueId,
      },
    });

    return result.count;
  }

  /**
   * Checks if a participant has already voted for a venue in an event.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @param venueId - Venue ID (Google Place ID)
   * @returns true if vote exists, false otherwise
   */
  async hasVoted(
    eventId: string,
    participantId: string,
    venueId: string
  ): Promise<boolean> {
    const vote = await this.db.vote.findUnique({
      where: {
        eventId_participantId_venueId: {
          eventId,
          participantId,
          venueId,
        },
      },
    });

    return vote !== null;
  }

  /**
   * Gets vote statistics for an event.
   * Returns aggregated vote counts and voter lists per venue.
   * @param eventId - Event ID
   * @returns Array of vote statistics per venue
   */
  async getVoteStatistics(eventId: string): Promise<VoteStats[]> {
    logger.debug({ eventId }, "Getting vote statistics");

    // Get all votes with venue details for the event
    const votes = await this.db.vote.findMany({
      where: { eventId },
      include: { venue: true },
    });

    // Group votes by venue ID and aggregate
    const venueMap = new Map<string, VoteStats>();

    for (const vote of votes) {
      const existing = venueMap.get(vote.venueId);

      if (existing) {
        existing.voteCount += 1;
        existing.voterIds.push(vote.participantId);
      } else {
        venueMap.set(vote.venueId, {
          venue: vote.venue,
          voteCount: 1,
          voterIds: [vote.participantId],
        });
      }
    }

    // Convert map to array and sort by vote count (descending)
    return Array.from(venueMap.values()).sort(
      (a, b) => b.voteCount - a.voteCount
    );
  }

  /**
   * Deletes all votes for a specific event.
   * Typically used when event is deleted (handled by CASCADE).
   * @param eventId - Event ID
   * @returns Number of deleted votes
   */
  async deleteByEventId(eventId: string): Promise<number> {
    logger.debug({ eventId }, "Deleting all votes for event");

    const result = await this.db.vote.deleteMany({
      where: { eventId },
    });

    return result.count;
  }

  /**
   * Deletes all votes for a specific participant.
   * Typically used when participant is deleted (handled by CASCADE).
   * @param participantId - Participant ID
   * @returns Number of deleted votes
   */
  async deleteByParticipantId(participantId: string): Promise<number> {
    logger.debug({ participantId }, "Deleting all votes for participant");

    const result = await this.db.vote.deleteMany({
      where: { participantId },
    });

    return result.count;
  }
}

/**
 * Factory function to create a VoteRepository instance.
 * @param db - Prisma client instance
 * @returns VoteRepository instance
 */
export function createVoteRepository(db: PrismaClient): VoteRepository {
  return new VoteRepository(db);
}
