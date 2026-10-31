/**
 * AMap implementation of MapProviderClient, used by China events.
 * @module lib/providers/amap
 */

import {
  amapGeocode,
  amapSearchNearby,
  amapTextSearch,
  amapGetDetails,
  amapCalculateBatchRoutes,
} from "../amap/index.js";
import type { MapProviderClient } from "./types.js";

export { isAmapVenueId } from "../amap/index.js";

export const amapProvider: MapProviderClient = {
  name: "amap",
  displayName: "AMap",
  geocode: amapGeocode,
  searchNearby: amapSearchNearby,
  textSearch: amapTextSearch,
  getDetails: amapGetDetails,
  // AMap photo references are already public image URLs without a key.
  photoUrl: (photoReference) => photoReference,
  calculateBatchRoutes: amapCalculateBatchRoutes,
};
