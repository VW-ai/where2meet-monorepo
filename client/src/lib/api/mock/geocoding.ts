/**
 * Geocoding API
 * Converts addresses to coordinates using Google Places API
 */

import type { Location } from '@/types';
import { getPlaceDetails } from '@/lib/google-maps/places-autocomplete';

/**
 * Get coordinates for an address using Google Places API
 * @param address Full address string
 * @param placeId Place ID from autocomplete
 * @returns Location coordinates
 */
export async function geocodeAddress(address: string, placeId: string): Promise<Location> {
  if (!placeId) {
    throw new Error('Place ID is required for geocoding');
  }

  try {
    // Use Google Places API to get actual coordinates
    const placeDetails = await getPlaceDetails(placeId);

    if (!placeDetails.geometry?.location) {
      throw new Error(`No location found for place: ${address}`);
    }

    const location: Location = {
      lat: placeDetails.geometry.location.lat(),
      lng: placeDetails.geometry.location.lng(),
    };

    // Successfully geocoded address

    return location;
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    throw new Error(`Failed to geocode address: ${address}`);
  }
}
