/**
 * Venue service module.
 *
 * Contains business logic for venue search operations.
 * Returns raw PlaceResult/PlaceDetails - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 * @module services/venue
 */

import type { PrismaClient } from "@prisma/client";
import {
  createVenueRepository,
  type VenueRepository,
  type VenueData,
} from "../repositories/venue.js";
import {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
  buildPhotoUrl,
  PlacesApiError,
  type PlaceResult,
  type PlaceDetails,
  type GeoPoint,
  CATEGORY_TO_PLACE_TYPE,
} from "../lib/places/index.js";
import { ExternalServiceError } from "../types/errors.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("VenueService");

/**
 * Result of a venue search operation.
 */
export interface VenueSearchResult {
  places: PlaceResult[];
  searchCenter: GeoPoint;
}

/**
 * Options for venue search.
 */
export interface SearchVenuesOptions {
  query?: string;
  categories?: string[];
}

/**
 * Service for venue business logic.
 *
 * All methods return raw Places API results. Transformation to
 * Response DTOs should be done in route handlers using mappers.
 */
export class VenueService {
  private readonly venueRepository: VenueRepository;

  constructor(db: PrismaClient) {
    this.venueRepository = createVenueRepository(db);
  }

  /**
   * Searches for venues near a specified center point.
   * @param center - Search center coordinates (user-provided)
   * @param searchRadius - Search radius in meters
   * @param options - Search filters (query and/or categories)
   * @returns Array of place results and search center
   * @throws ExternalServiceError if Places API fails
   */
  async searchVenues(
    center: GeoPoint,
    searchRadius: number,
    options: SearchVenuesOptions
  ): Promise<VenueSearchResult> {
    try {
      let places: PlaceResult[] = [];

      // Search by query (text search)
      if (options.query) {
        const textResults = await textSearchPlaces(options.query, center, searchRadius);
        places = [...places, ...textResults];
      }

      // Search by categories (nearby search)
      if (options.categories && options.categories.length > 0) {
        for (const category of options.categories) {
          const placeType = CATEGORY_TO_PLACE_TYPE[category];
          if (placeType) {
            const categoryResults = await searchNearbyPlaces(center, searchRadius, {
              type: placeType,
            });
            places = [...places, ...categoryResults];
          }
        }
      }

      // Deduplicate by placeId
      const uniquePlaces = this.deduplicatePlaces(places);

      // Sort by rating (highest first), nulls last
      const sortedPlaces = this.sortByRating(uniquePlaces);

      logger.info(
        {
          center,
          searchRadius,
          query: options.query,
          categories: options.categories,
          resultCount: sortedPlaces.length,
        },
        "Venue search completed"
      );

      return { places: sortedPlaces, searchCenter: center };
    } catch (error) {
      if (error instanceof PlacesApiError) {
        logger.error({ err: error, center }, "Places API error during search");
        throw new ExternalServiceError("Google Places", error.message);
      }
      throw error;
    }
  }

  /**
   * Gets detailed information about a venue.
   *
   * Uses Redis → Google API flow to ensure complete field coverage.
   * PostgreSQL cache only stores subset of fields for voting operations,
   * so we bypass it here to return full PlaceDetails (phone, website, hours, etc.).
   *
   * Still upserts to PostgreSQL in background for voting cache efficiency.
   * @param placeId - Google Place ID
   * @returns Detailed place information with all fields
   * @throws ExternalServiceError if Places API fails
   */
  async getVenueDetails(placeId: string): Promise<PlaceDetails> {
    try {
      // Always use Redis → Google API for full field coverage
      // PostgreSQL only stores a subset of fields for voting operations
      const details = await getPlaceDetails(placeId);

      // Background upsert to PostgreSQL for voting cache (non-blocking)
      this.venueRepository.upsert(this.placeDetailsToVenueData(details)).catch((error: unknown) => {
        logger.error({ err: error, placeId }, "Failed to upsert venue to database");
      });

      logger.info({ placeId, source: "api", name: details.name }, "Venue details fetched");
      return details;
    } catch (error) {
      if (error instanceof PlacesApiError) {
        logger.error({ err: error, placeId }, "Places API error fetching details");
        throw new ExternalServiceError("Google Places", error.message);
      }
      throw error;
    }
  }

  /**
   * Converts PlaceDetails API type to VenueData for database storage.
   * Extracts and simplifies fields for persistent cache.
   */
  private placeDetailsToVenueData(details: PlaceDetails): VenueData {
    return {
      id: details.placeId,
      name: details.name,
      address: details.address ? details.address : null,
      lat: details.location.lat,
      lng: details.location.lng,
      category: details.types[0] ?? null,
      rating: details.rating,
      priceLevel: details.priceLevel,
      photoUrl: details.photoReference ? buildPhotoUrl(details.photoReference) : null,
    };
  }

  /**
   * Removes duplicate places by placeId.
   */
  private deduplicatePlaces(places: PlaceResult[]): PlaceResult[] {
    const seen = new Set<string>();
    return places.filter((place) => {
      if (seen.has(place.placeId)) {
        return false;
      }
      seen.add(place.placeId);
      return true;
    });
  }

  /**
   * Sorts places by rating (highest first), nulls last.
   */
  private sortByRating(places: PlaceResult[]): PlaceResult[] {
    return [...places].sort((a, b) => {
      if (a.rating === null && b.rating === null) return 0;
      if (a.rating === null) return 1;
      if (b.rating === null) return -1;
      return b.rating - a.rating;
    });
  }
}

/**
 * Creates a new VenueService instance.
 * @param db - Prisma client instance
 * @returns VenueService instance
 */
export function createVenueService(db: PrismaClient): VenueService {
  return new VenueService(db);
}
