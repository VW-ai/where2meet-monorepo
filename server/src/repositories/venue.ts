/**
 * Venue repository module.
 *
 * Handles all database operations for global Venue entities.
 * Supports 5-day refresh logic for venue data optimization.
 * @module repositories/venue
 */

import type { PrismaClient, Venue } from "../generated/prisma/index.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("VenueRepository");

/** 5-day staleness threshold in milliseconds */
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Data for creating or updating a venue in the database.
 * Venue data comes from Google Places API.
 */
export interface VenueData {
  id: string; // Google Place ID
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  photoUrl: string | null;
}

/**
 * Repository for Venue database operations.
 * Manages global venue cache with staleness tracking.
 */
export class VenueRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Finds a venue by its Google Place ID.
   * @param placeId - Google Place ID
   * @returns Venue if found, null otherwise
   */
  async findById(placeId: string): Promise<Venue | null> {
    logger.debug({ placeId }, "Finding venue by ID");

    return this.db.venue.findUnique({
      where: { id: placeId },
    });
  }

  /**
   * Checks if a venue's data is stale (≥ 5 days old).
   * @param placeId - Google Place ID
   * @returns true if venue doesn't exist or is stale, false if fresh
   */
  async isStale(placeId: string): Promise<boolean> {
    const venue = await this.findById(placeId);

    if (!venue) {
      logger.debug({ placeId }, "Venue not found (considered stale)");
      return true;
    }

    const age = Date.now() - venue.updatedAt.getTime();
    const isStale = age >= FIVE_DAYS_MS;

    logger.debug({ placeId, ageMs: age, isStale }, "Checked venue staleness");

    return isStale;
  }

  /**
   * Creates or updates a venue in the global cache.
   * Updates the updatedAt timestamp to track freshness.
   * @param venueData - Venue data from Google Places API
   * @returns Created or updated venue
   */
  async upsert(venueData: VenueData): Promise<Venue> {
    logger.debug({ placeId: venueData.id }, "Upserting venue");

    return this.db.venue.upsert({
      where: { id: venueData.id },
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
        id: venueData.id,
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
  }

  /**
   * Deletes a venue from the global cache.
   * Note: Typically not used since venues are shared across events.
   * Only delete if no votes reference the venue.
   * @param placeId - Google Place ID
   */
  async delete(placeId: string): Promise<void> {
    logger.debug({ placeId }, "Deleting venue");

    await this.db.venue.delete({
      where: { id: placeId },
    });
  }
}

/**
 * Factory function to create a VenueRepository instance.
 * @param db - Prisma client instance
 * @returns VenueRepository instance
 */
export function createVenueRepository(db: PrismaClient): VenueRepository {
  return new VenueRepository(db);
}
