/**
 * Google Directions API Service
 *
 * Calculates routes between participants and venues
 */

import { loadGoogleMaps } from './loader';
import type { Location, TravelMode } from '@/shared/types/map';

export interface DirectionsResult {
  distance: string; // e.g., "2.5 km"
  duration: string; // e.g., "8 mins"
  polyline: google.maps.LatLng[];
  steps: google.maps.DirectionsStep[];
}

/**
 * Map our travel mode to Google's travel mode
 */
function getGoogleTravelMode(maps: typeof google.maps, mode: TravelMode): google.maps.TravelMode {
  const modeMap: Record<TravelMode, google.maps.TravelMode> = {
    driving: maps.TravelMode.DRIVING,
    walking: maps.TravelMode.WALKING,
    transit: maps.TravelMode.TRANSIT,
    bicycling: maps.TravelMode.BICYCLING,
  };
  return modeMap[mode] || maps.TravelMode.DRIVING;
}

/**
 * Calculate route between two points
 */
export async function calculateRoute(
  origin: Location,
  destination: Location,
  travelMode: TravelMode = 'driving'
): Promise<DirectionsResult | null> {
  try {
    const maps = await loadGoogleMaps();
    const directionsService = new maps.DirectionsService();

    const request: google.maps.DirectionsRequest = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: getGoogleTravelMode(maps, travelMode),
    };

    return new Promise((resolve) => {
      directionsService.route(request, (result, status) => {
        if (status === maps.DirectionsStatus.OK && result) {
          const route = result.routes[0];
          const leg = route.legs[0];

          resolve({
            distance: leg.distance?.text || 'Unknown',
            duration: leg.duration?.text || 'Unknown',
            polyline: route.overview_path,
            steps: leg.steps,
          });
        } else if (status === maps.DirectionsStatus.ZERO_RESULTS) {
          resolve(null);
        } else {
          console.error('[Directions] Error:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('[Directions] Error calculating route:', error);
    return null;
  }
}

/**
 * Calculate routes from multiple origins to a single destination
 */
export async function calculateMultipleRoutes(
  origins: { id: string; location: Location }[],
  destination: Location,
  travelMode: TravelMode = 'driving'
): Promise<Map<string, DirectionsResult | null>> {
  const results = new Map<string, DirectionsResult | null>();

  // Calculate routes in parallel (with some rate limiting)
  const batchSize = 5;
  for (let i = 0; i < origins.length; i += batchSize) {
    const batch = origins.slice(i, i + batchSize);
    const promises = batch.map(async ({ id, location }) => {
      const result = await calculateRoute(location, destination, travelMode);
      return { id, result };
    });

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ id, result }) => {
      results.set(id, result);
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < origins.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
