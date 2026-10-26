/**
 * Venue mapper module.
 *
 * Transforms Places API results to Response DTOs with runtime validation.
 * @module mappers/venue
 */

import type { PlaceResult, PlaceDetails, GeoPoint } from "../lib/places/index.js";
import { providerForVenueId } from "../lib/providers/index.js";
import {
  VenueResponseSchema,
  VenueDetailsResponseSchema,
  VenueSearchResponseSchema,
  type VenueResponse,
  type VenueDetailsResponse,
  type VenueSearchResponse,
} from "../dto/venue.dto.js";

/** Resolves a place's photo with the provider that issued it. */
function photoUrlOf(place: PlaceResult): string | null {
  return place.photoReference
    ? providerForVenueId(place.placeId).photoUrl(place.photoReference)
    : null;
}

/**
 * Transforms a PlaceResult to VenueResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVenueResponse(place: PlaceResult): VenueResponse {
  const response = {
    id: place.placeId,
    name: place.name,
    address: place.address,
    location: {
      lat: place.location.lat,
      lng: place.location.lng,
    },
    types: place.types,
    rating: place.rating,
    userRatingsTotal: place.userRatingsTotal,
    priceLevel: place.priceLevel,
    openNow: place.openNow,
    photoUrl: photoUrlOf(place),
  };

  return VenueResponseSchema.parse(response);
}

/**
 * Transforms a PlaceDetails to VenueDetailsResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVenueDetailsResponse(details: PlaceDetails): VenueDetailsResponse {
  const response = {
    id: details.placeId,
    name: details.name,
    address: details.address,
    location: {
      lat: details.location.lat,
      lng: details.location.lng,
    },
    types: details.types,
    rating: details.rating,
    userRatingsTotal: details.userRatingsTotal,
    priceLevel: details.priceLevel,
    openNow: details.openNow,
    photoUrl: photoUrlOf(details),
    formattedPhoneNumber: details.formattedPhoneNumber,
    website: details.website,
    openingHours: details.openingHours,
  };

  return VenueDetailsResponseSchema.parse(response);
}

/**
 * Transforms an array of PlaceResults to VenueSearchResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 */
export function toVenueSearchResponse(
  places: PlaceResult[],
  searchCenter: GeoPoint
): VenueSearchResponse {
  const response = {
    venues: places.map(toVenueResponse),
    totalResults: places.length,
    searchCenter: {
      lat: searchCenter.lat,
      lng: searchCenter.lng,
    },
  };

  return VenueSearchResponseSchema.parse(response);
}
