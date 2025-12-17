/**
 * Google Places API service.
 *
 * Provides venue search and details with Redis caching and retry logic.
 * @module lib/places
 */

// Types
export type {
  GeoPoint,
  PlaceResult,
  PlaceDetails,
  VenueCategory,
} from "./types.js";
export { CATEGORY_TO_PLACE_TYPE } from "./types.js";

// Errors
export { PlaceNotFoundError, PlacesApiError } from "./errors.js";

// Search operations
export {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
  buildPhotoUrl,
  isPlacesConfigured,
} from "./search.js";
