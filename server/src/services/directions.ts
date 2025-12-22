/**
 * Directions service module.
 *
 * Contains business logic for route calculation operations.
 * Returns raw RouteResult - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 * @module services/directions
 */

import type { PrismaClient } from "../generated/prisma/index.js";
import {
  createEventRepository,
  type EventRepository,
} from "../repositories/event.js";
import {
  createVenueRepository,
  type VenueRepository,
} from "../repositories/venue.js";
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
   *
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

    // Get participants with valid coordinates (exclude organizer and null locations)
    let participants = event.participants.filter(
      (p) => p.lat !== null && p.lng !== null && !p.isOrganizer
    );

    // Filter to single participant if specified
    if (participantId) {
      const participant = participants.find((p) => p.id === participantId);
      if (!participant) {
        // Check if participant exists at all (might be organizer or have no location)
        const anyParticipant = event.participants.find((p) => p.id === participantId);
        if (!anyParticipant) {
          throw new ParticipantNotFoundError(participantId);
        }
        // Participant exists but has no valid location
        throw new ValidationError(
          `Participant ${participantId} does not have a valid location for directions`
        );
      }
      participants = [participant];
    }

    if (participants.length === 0) {
      logger.info({ eventId, venueId }, "No participants with valid locations");
      return [];
    }

    try {
      // Calculate routes for all participants in parallel
      const participantData = participants.map((p) => ({
        id: p.id,
        lat: Number(p.lat),
        lng: Number(p.lng),
      }));

      const routes = await calculateBatchRoutes(participantData, venueCoords, travelMode);

      logger.info(
        {
          eventId,
          venueId,
          travelMode,
          participantCount: participants.length,
          routeCount: routes.length,
        },
        "Directions calculated"
      );

      return routes;
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
