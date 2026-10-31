/**
 * Contract every map data provider implements.
 *
 * Services depend on this interface instead of a provider module so an event
 * can be served by Google Maps or AMap. Implementations return WGS-84
 * coordinates and throw the shared error classes from lib/maps, lib/places
 * and lib/directions, so service error handling is provider-agnostic.
 * @module lib/providers/types
 */

import type { MapProvider } from "@prisma/client";
import type { GeocodeResult } from "../maps.js";
import type { GeoPoint, PlaceDetails, PlaceResult, VenueCategory } from "../places/index.js";
import type { ParticipantLocation, RouteResult, TravelMode } from "../directions/index.js";

export interface MapProviderClient {
  readonly name: MapProvider;
  /** Name used in ExternalServiceError messages. */
  readonly displayName: string;

  geocode(address: string): Promise<GeocodeResult>;

  searchNearby(
    center: GeoPoint,
    radiusMeters: number,
    category: VenueCategory
  ): Promise<PlaceResult[]>;

  textSearch(query: string, center: GeoPoint, radiusMeters: number): Promise<PlaceResult[]>;

  getDetails(placeId: string): Promise<PlaceDetails>;

  /** Turns a PlaceResult.photoReference into a URL a browser can load. */
  photoUrl(photoReference: string): string;

  calculateBatchRoutes(
    participants: ParticipantLocation[],
    venue: GeoPoint,
    mode: TravelMode
  ): Promise<RouteResult[]>;
}
