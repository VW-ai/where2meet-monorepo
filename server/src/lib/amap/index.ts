/**
 * AMap (Gaode) Web Service API for China events.
 *
 * Google Maps is blocked in mainland China and has little data there. Events
 * created with mapProvider "amap" use this module for geocoding, venue search,
 * autocomplete and routes. Every function takes and returns WGS-84; GCJ-02
 * conversion happens inside (see lib/geo/coords).
 * @module lib/amap
 */

export { isAmapConfigured } from "./client.js";
export { amapGeocode, amapReverseGeocode, type AmapReverseGeocodeResult } from "./geocode.js";
export { amapSuggest, type AmapSuggestion } from "./suggest.js";
export { amapSearchNearby, amapTextSearch, amapGetDetails } from "./places.js";
export { amapCalculateRoute, amapCalculateBatchRoutes } from "./routes.js";
export { isAmapVenueId } from "./parse.js";
