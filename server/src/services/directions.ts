/**
 * Directions service module.
 *
 * Contains business logic for route calculation operations.
 * Returns raw RouteResult - transformation to Response DTOs
 * is handled by mappers in the route handlers.
 * @module services/directions
 */

import type { Participant, PrismaClient } from "@prisma/client";
import type { MapProviderClient } from "../lib/providers/index.js";
import { createEventRepository, type EventRepository } from "../repositories/event.js";
import { createVenueRepository, type VenueRepository } from "../repositories/venue.js";
import {
  DirectionsApiError,
  type GeoPoint,
  type ModeRouteResult,
  type ParticipantLocation,
  type TravelMode,
} from "../lib/directions/index.js";
import {
  EventNotFoundError,
  ParticipantNotFoundError,
  ValidationError,
  ExternalServiceError,
} from "../types/errors.js";
import { PlacesApiError } from "../lib/places/index.js";
import { providerFor, providerForVenueId } from "../lib/providers/index.js";
import { createLogger } from "../lib/logger.js";
import { geocodeWithBusinessErrors } from "./participant.js";

const TRAVEL_MODES: readonly TravelMode[] = ["driving", "walking", "transit", "bicycling"];
// Nobody is routed yet, but the provider labels each result with an id
const PREVIEW_ROUTE_ID = "preview";

/** A place someone could start from, and each way to get from there to the venue. */
export interface ParticipantPreview {
  location: GeoPoint;
  formattedAddress: string;
  routes: ModeRouteResult[];
}

const logger = createLogger("DirectionsService");

/**
 * @param participant - Participant being routed
 * @param override - Mode sent with the request, if any
 * @returns The mode this participant's route uses
 */
function effectiveTravelMode(participant: Participant, override?: TravelMode): TravelMode {
  return override ?? participant.travelMode;
}

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
   * @param travelModeOverride - Mode for everyone returned; omit to use each participant's own
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
    travelModeOverride?: TravelMode,
    participantId?: string
  ): Promise<ModeRouteResult[]> {
    // Verify event exists
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const venueCoords = await this.resolveVenueCoords(venueId);

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
    const nullRoutes: ModeRouteResult[] = participantsWithoutLocation.map((p) => ({
      participantId: p.id,
      distance: null,
      duration: null,
      polyline: null,
      travelMode: effectiveTravelMode(p, travelModeOverride),
    }));

    // If no participants have locations, return all null routes
    if (participantsWithLocation.length === 0) {
      logger.info({ eventId, venueId }, "No participants with valid locations");
      return nullRoutes;
    }

    const locationsByMode = new Map<TravelMode, ParticipantLocation[]>();
    for (const p of participantsWithLocation) {
      const mode = effectiveTravelMode(p, travelModeOverride);
      const locations = locationsByMode.get(mode) ?? [];
      locations.push({ id: p.id, lat: Number(p.lat), lng: Number(p.lng) });
      locationsByMode.set(mode, locations);
    }

    const calculatedRoutes = await this.calculateByMode(
      providerFor(event.mapProvider),
      [...locationsByMode],
      venueCoords,
      venueId
    );

    logger.info(
      {
        eventId,
        venueId,
        travelModes: [...locationsByMode.keys()],
        participantCount: allParticipants.length,
        withLocation: participantsWithLocation.length,
        withoutLocation: participantsWithoutLocation.length,
      },
      "Directions calculated"
    );

    // Combine calculated routes with null routes
    return [...calculatedRoutes, ...nullRoutes];
  }

  /**
   * Geocodes an address and, given a venue, routes it there in every mode. Writes nothing.
   * @param eventId - Event whose map provider serves the lookup
   * @param address - Address the person would start from
   * @param venueId - Destination venue, if one is selected
   * @returns The geocoded place and one route per mode that has one
   * @throws EventNotFoundError if event doesn't exist
   * @throws BusinessAddressNotFoundError if the address cannot be geocoded
   * @throws ValidationError if the venue ID is invalid
   * @throws ExternalServiceError if a provider API fails
   */
  async previewParticipant(
    eventId: string,
    address: string,
    venueId?: string
  ): Promise<ParticipantPreview> {
    const status = await this.eventRepository.getStatus(eventId);
    if (!status) {
      throw new EventNotFoundError(eventId);
    }

    const { lat, lng, formattedAddress } = await geocodeWithBusinessErrors(
      status.mapProvider,
      address
    );
    const location = { lat, lng };
    if (!venueId) {
      return { location, formattedAddress, routes: [] };
    }

    const origin: ParticipantLocation = { id: PREVIEW_ROUTE_ID, lat, lng };
    const routes = await this.calculateByMode(
      providerFor(status.mapProvider),
      TRAVEL_MODES.map((mode) => [mode, [origin]]),
      await this.resolveVenueCoords(venueId),
      venueId
    );
    return { location, formattedAddress, routes };
  }

  /**
   * Finds a venue's coordinates in the database, or from its provider for a candidate
   * venue that hasn't been persisted.
   * @param venueId - Destination venue
   * @returns The venue's coordinates
   * @throws ValidationError if the provider doesn't know the venue
   * @throws ExternalServiceError if the provider API fails
   */
  private async resolveVenueCoords(venueId: string): Promise<GeoPoint> {
    const venue = await this.venueRepository.findById(venueId);
    if (venue) {
      return { lat: Number(venue.lat), lng: Number(venue.lng) };
    }

    const venueProvider = providerForVenueId(venueId);
    try {
      logger.debug({ venueId }, "Venue not in database, fetching from Places API");
      const details = await venueProvider.getDetails(venueId);
      return details.location;
    } catch (error) {
      if (error instanceof PlacesApiError) {
        if (error.status === "NOT_FOUND" || error.status === "INVALID_REQUEST") {
          throw new ValidationError(`Invalid venue ID: ${venueId}`);
        }
        throw new ExternalServiceError(venueProvider.displayName, error.message);
      }
      throw error;
    }
  }

  /**
   * Makes one provider call per mode. A trip with no route is left out by the provider.
   * @param routeProvider - Provider of the event
   * @param requests - Who to route in each mode
   * @param venueCoords - Destination
   * @param venueId - Destination, for the log
   * @returns The routes found, labeled with their mode
   * @throws ExternalServiceError if the Directions API fails
   */
  private async calculateByMode(
    routeProvider: MapProviderClient,
    requests: readonly (readonly [TravelMode, ParticipantLocation[]])[],
    venueCoords: GeoPoint,
    venueId: string
  ): Promise<ModeRouteResult[]> {
    try {
      const routes = await Promise.all(
        requests.map(async ([travelMode, locations]) => {
          const found = await routeProvider.calculateBatchRoutes(
            locations,
            venueCoords,
            travelMode
          );
          return found.map((route) => ({ ...route, travelMode }));
        })
      );
      return routes.flat();
    } catch (error) {
      if (error instanceof DirectionsApiError) {
        logger.error({ err: error, venueId }, "Directions API error");
        throw new ExternalServiceError(routeProvider.displayName, error.message);
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
