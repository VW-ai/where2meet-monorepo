/**
 * Vote service module.
 *
 * Contains business logic for voting operations.
 * All voting operations use transactions to ensure atomicity and consistency.
 * @module services/vote
 */

import type { PrismaClient, Vote } from "../generated/prisma/index.js";
import {
  createEventRepository,
  type EventRepository,
} from "../repositories/event.js";
import {
  createVoteRepository,
  type VoteRepository,
  type VoteStats,
} from "../repositories/vote.js";
import type { VenueData } from "../repositories/venue.js";
import {
  EventNotFoundError,
  ParticipantNotFoundError,
  EventAlreadyPublishedError,
} from "../types/errors.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("VoteService");

/**
 * Service for vote business logic.
 * Implements transactional voting to ensure data consistency.
 */
export class VoteService {
  private readonly eventRepository: EventRepository;
  private readonly voteRepository: VoteRepository;
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
    this.eventRepository = createEventRepository(db);
    this.voteRepository = createVoteRepository(db);
  }

  /**
   * Casts a vote for a venue in an event.
   *
   * CRITICAL: This operation is wrapped in a Prisma transaction to ensure atomicity.
   * Transaction steps:
   * 1. Verify event exists and is not published
   * 2. Verify participant belongs to the event
   * 3. Upsert venue to global table (with 5-day refresh logic)
   * 4. Insert vote record (handles P2002 for idempotency)
   *
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @param venueId - Venue ID (Google Place ID)
   * @param venueData - Venue data from Google Places API
   * @returns Created or existing vote
   * @throws EventNotFoundError if event doesn't exist
   * @throws ParticipantNotFoundError if participant not in event
   * @throws EventAlreadyPublishedError if event is published
   */
  async castVote(
    eventId: string,
    participantId: string,
    venueId: string,
    venueData: VenueData
  ): Promise<Vote> {
    logger.info(
      { eventId, participantId, venueId },
      "Casting vote (transaction start)"
    );

    return await this.db.$transaction(async (tx) => {
      // Step 1: Verify event exists and is not published (lightweight query)
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, publishedAt: true },
      });

      if (!event) {
        logger.warn({ eventId }, "Event not found");
        throw new EventNotFoundError(eventId);
      }

      if (event.publishedAt) {
        logger.warn({ eventId, publishedAt: event.publishedAt }, "Event already published");
        throw new EventAlreadyPublishedError();
      }

      // Step 2: Verify participant belongs to event (lightweight query)
      const participant = await tx.participant.findFirst({
        where: { id: participantId, eventId },
        select: { id: true },
      });

      if (!participant) {
        logger.warn(
          { eventId, participantId },
          "Participant not found in event"
        );
        throw new ParticipantNotFoundError(participantId);
      }

      // Step 3: Upsert venue to global table (with 5-day refresh check)
      // This ensures venue data is available for vote statistics queries
      await tx.venue.upsert({
        where: { id: venueId },
        update: {
          name: venueData.name,
          address: venueData.address,
          lat: venueData.lat,
          lng: venueData.lng,
          category: venueData.category,
          rating: venueData.rating,
          priceLevel: venueData.priceLevel,
          photoUrl: venueData.photoUrl,
          updatedAt: new Date(),
        },
        create: {
          id: venueId,
          name: venueData.name,
          address: venueData.address,
          lat: venueData.lat,
          lng: venueData.lng,
          category: venueData.category,
          rating: venueData.rating,
          priceLevel: venueData.priceLevel,
          photoUrl: venueData.photoUrl,
        },
      });

      // Step 4: Insert vote record (with P2002 handling for idempotency)
      try {
        const vote = await tx.vote.create({
          data: {
            eventId,
            participantId,
            venueId,
          },
        });

        logger.info(
          { eventId, participantId, venueId, voteId: vote.id },
          "Vote created successfully"
        );

        return vote;
      } catch (error) {
        // Handle Prisma P2002 (unique constraint violation)
        // This means participant already voted for this venue in this event
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          logger.info(
            { eventId, participantId, venueId },
            "Duplicate vote detected (idempotent)"
          );

          // Return existing vote (idempotent behavior)
          const existingVote = await tx.vote.findUnique({
            where: {
              eventId_participantId_venueId: {
                eventId,
                participantId,
                venueId,
              },
            },
          });

          if (!existingVote) {
            // This should never happen, but handle it gracefully
            throw new Error("Failed to retrieve existing vote after P2002 error");
          }

          return existingVote;
        }

        // Re-throw if not P2002 error
        throw error;
      }
    });
  }

  /**
   * Removes a vote for a venue in an event.
   * Uses deleteMany for idempotency (no error if vote doesn't exist).
   *
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @param venueId - Venue ID (Google Place ID)
   * @returns true if vote was deleted, false if it didn't exist
   */
  async removeVote(
    eventId: string,
    participantId: string,
    venueId: string
  ): Promise<boolean> {
    logger.info(
      { eventId, participantId, venueId },
      "Removing vote"
    );

    const count = await this.voteRepository.deleteByEventParticipantVenue(
      eventId,
      participantId,
      venueId
    );

    const deleted = count > 0;

    logger.info(
      { eventId, participantId, venueId, deleted },
      "Vote removal completed"
    );

    return deleted;
  }

  /**
   * Gets vote statistics for an event.
   * Returns aggregated vote counts and voter lists per venue.
   *
   * @param eventId - Event ID
   * @returns Vote statistics with venue details
   * @throws EventNotFoundError if event doesn't exist
   */
  async getVoteStatistics(eventId: string): Promise<VoteStats[]> {
    logger.debug({ eventId }, "Getting vote statistics");

    // Verify event exists
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    // Get aggregated vote statistics
    const stats = await this.voteRepository.getVoteStatistics(eventId);

    logger.info(
      { eventId, venueCount: stats.length, totalVotes: stats.reduce((sum, s) => sum + s.voteCount, 0) },
      "Vote statistics retrieved"
    );

    return stats;
  }
}

/**
 * Creates a new VoteService instance.
 * @param db - Prisma client instance
 * @returns VoteService instance
 */
export function createVoteService(db: PrismaClient): VoteService {
  return new VoteService(db);
}
