/**
 * Map provider selection.
 *
 * An event's mapProvider picks the provider for geocoding, venue search and
 * routes. Venue IDs carry their provider (AMap IDs start with "amap:"), so
 * venue lookups need no event context.
 * @module lib/providers
 */

import type { MapProvider } from "@prisma/client";
import { amapProvider, isAmapVenueId } from "./amap.js";
import { googleProvider } from "./google.js";
import type { MapProviderClient } from "./types.js";

export type { MapProviderClient } from "./types.js";

/**
 * Returns the client for a provider name.
 * @param provider - Provider stored on the event
 */
export function providerFor(provider: MapProvider): MapProviderClient {
  return provider === "amap" ? amapProvider : googleProvider;
}

/**
 * Returns the client that issued a venue ID.
 * @param venueId - Google Place ID or "amap:<POI id>"
 */
export function providerForVenueId(venueId: string): MapProviderClient {
  return isAmapVenueId(venueId) ? amapProvider : googleProvider;
}
