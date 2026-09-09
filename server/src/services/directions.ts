/**
 * Directions service module.
 *
 * Contains business logic for route calculation operations.
 * Returns raw RouteResult - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 * @module services/directions
 */

import type { PrismaClient } from "@prisma/client";
import { createEventRepository, type EventRepository } from "../repositories/event.js";
import { createVenueRepository, type VenueRepository } from "../repositories/venue.js";
import {
  calculateBatchRoutes,
  DirectionsApiError,
  type TravelMode,
  type RouteResult,
} from "../lib/directions/index.js";
import {
  EventNotFoundError,
  ParticipantNotFoundError,
  ValidationError,
  ExternalServiceError,
} from "../types/errors.js";
import { getPlaceDetails, PlacesApiError } from "../lib/places/index.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("DirectionsService");

/**
 * Service for directions business logic.
 *
 * All methods return raw route results. Transformation to
 * Response DTOs should be done in route handlers using mappers.
 */
export class DirectionsService {
  private readonly eventRepository: EventRepository;
  private readonly venueRepository: VenueRepository;

  constructor(db: PrismaClient) {
    this.eventRepository = createEventRepository(db);
    this.venueRepository = createVenueRepository(db);
  }

  /**
   * Calculates routes for participants to a venue.
   * @param eventId - Event ID to get participants from
   * @param venueId - Google Place ID of the destination venue
   * @param travelMode - Travel mode (driving, walking, transit, bicycling)
   * @param participantId - Optional: Calculate route for single participant
   * @returns Array of route results (one per participant)
   * @throws EventNotFoundError if event doesn't exist
   * @throws ValidationError if venue not found or no valid participants
   * @throws ParticipantNotFoundError if specified participantId not found
   * @throws ExternalServiceError if Directions API fails
   */
  async getDirections(
    eventId: string,
    venueId: string,
    travelMode: TravelMode,
    participantId?: string
  ): Promise<RouteResult[]> {
    // Verify event exists
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    // Get venue coordinates from database or fallback to Google Places API
    let venueCoords: { lat: number; lng: number };
    const venue = await this.venueRepository.findById(venueId);

    if (venue) {
      venueCoords = {
        lat: Number(venue.lat),
        lng: Number(venue.lng),
      };
    } else {
      // Fallback: fetch from Google Places API for candidate venues not yet persisted
      try {
        logger.debug({ venueId }, "Venue not in database, fetching from Places API");
        const details = await getPlaceDetails(venueId);
        venueCoords = details.location;
      } catch (error) {
        if (error instanceof PlacesApiError) {
          if (error.status === "NOT_FOUND" || error.status === "INVALID_REQUEST") {
            throw new ValidationError(`Invalid venue ID: ${venueId}`);
          }
          throw new ExternalServiceError("Google Places", error.message);
        }
        throw error;
      }
    }

    // Get all participants (optionally filter to single participant)
    let allParticipants = event.participants;

    if (participantId) {
      const participant = allParticipants.find((p) => p.id === participantId);
      if (!participant) {
        throw new ParticipantNotFoundError(participantId);
      }
      allParticipants = [participant];
    }

    if (allParticipants.length === 0) {
      return [];
    }

    // Separate participants with and without valid locations
    const participantsWithLocation = allParticipants.filter(
      (p) => p.lat !== null && p.lng !== null
    );
    const participantsWithoutLocation = allParticipants.filter(
      (p) => p.lat === null || p.lng === null
    );

    // Build results for participants without location (null values)
    const nullRoutes: RouteResult[] = participantsWithoutLocation.map((p) => ({
      participantId: p.id,
      distance: null,
      duration: null,
      polyline: null,
    }));

    // If no participants have locations, return all null routes
    if (participantsWithLocation.length === 0) {
      logger.info({ eventId, venueId }, "No participants with valid locations");
      return nullRoutes;
    }

    try {
      // Calculate routes for participants with valid locations
      const participantData = participantsWithLocation.map((p) => ({
        id: p.id,
        lat: Number(p.lat),
        lng: Number(p.lng),
      }));

      const calculatedRoutes = await calculateBatchRoutes(participantData, venueCoords, travelMode);

      logger.info(
        {
          eventId,
          venueId,
          travelMode,
          participantCount: allParticipants.length,
          withLocation: participantsWithLocation.length,
          withoutLocation: participantsWithoutLocation.length,
        },
        "Directions calculated"
      );

      // Combine calculated routes with null routes
      return [...calculatedRoutes, ...nullRoutes];
    } catch (error) {
      if (error instanceof DirectionsApiError) {
        logger.error({ err: error, eventId, venueId }, "Directions API error");
        throw new ExternalServiceError("Google Directions", error.message);
      }
      throw error;
    }
  }
}

/**
 * Creates a new DirectionsService instance.
 * @param db - Prisma client instance
 * @returns DirectionsService instance
 */
export function createDirectionsService(db: PrismaClient): DirectionsService {
  return new DirectionsService(db);
}
