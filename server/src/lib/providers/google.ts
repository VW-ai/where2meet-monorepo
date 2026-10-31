/**
 * Google Maps implementation of MapProviderClient.
 *
 * Delegates to the existing lib/maps, lib/places and lib/directions modules.
 * @module lib/providers/google
 */

import { geocode } from "../maps.js";
import {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
  buildPhotoUrl,
  CATEGORY_TO_PLACE_TYPE,
} from "../places/index.js";
import { calculateBatchRoutes } from "../directions/index.js";
import type { MapProviderClient } from "./types.js";

export const googleProvider: MapProviderClient = {
  name: "google",
  displayName: "Google Maps",
  geocode,
  searchNearby: (center, radiusMeters, category) =>
    searchNearbyPlaces(center, radiusMeters, { type: CATEGORY_TO_PLACE_TYPE[category] }),
  textSearch: textSearchPlaces,
  getDetails: getPlaceDetails,
  photoUrl: (photoReference) => buildPhotoUrl(photoReference),
  calculateBatchRoutes,
};
