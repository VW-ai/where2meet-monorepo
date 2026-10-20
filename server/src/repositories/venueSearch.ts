/**
 * Venue search repository module.
 *
 * Handles database operations for VenueSearch rows, one per venue search made from a meeting.
 * @module repositories/venueSearch
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Data for recording a venue search.
 */
export interface CreateVenueSearchData {
  eventId: string;
  participantId: string;
  query: string;
  resultCount: number;
}

/**
 * Repository for VenueSearch database operations.
 */
export class VenueSearchRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Inserts a venue search.
   * @param search - Meeting, searching participant, query text and result count
   */
  async create(search: CreateVenueSearchData): Promise<void> {
    await this.db.venueSearch.create({
      data: {
        eventId: search.eventId,
        participantId: search.participantId,
        query: search.query,
        resultCount: search.resultCount,
      },
    });
  }
}

/**
 * Factory function to create a VenueSearchRepository instance.
 * @param db - Prisma client instance
 * @returns VenueSearchRepository instance
 */
export function createVenueSearchRepository(db: PrismaClient): VenueSearchRepository {
  return new VenueSearchRepository(db);
}
