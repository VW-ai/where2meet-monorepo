/**
 * Google Places Autocomplete Service
 *
 * Provides autocomplete suggestions for addresses and venues
 */

import { loadGoogleMaps } from './loader';

export interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  full_address: string;
}

/**
 * Search for place predictions using Google Places Autocomplete
 */
export async function searchPlacesAutocomplete(
  query: string,
  options?: {
    types?: string[];
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    radius?: number;
  }
): Promise<PlacePrediction[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const maps = await loadGoogleMaps();
    const service = new maps.places.AutocompleteService();

    // Convert LatLngLiteral to LatLng if needed
    const location = options?.location
      ? options.location instanceof maps.LatLng
        ? options.location
        : new maps.LatLng(options.location.lat, options.location.lng)
      : undefined;

    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      types: options?.types,
      location,
      radius: options?.radius,
    };

    return new Promise((resolve, reject) => {
      service.getPlacePredictions(request, (predictions, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && predictions) {
          const results: PlacePrediction[] = predictions.map((prediction) => ({
            place_id: prediction.place_id,
            description: prediction.description,
            main_text: prediction.structured_formatting.main_text,
            secondary_text: prediction.structured_formatting.secondary_text || '',
            full_address: prediction.description,
          }));
          resolve(results);
        } else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Places Autocomplete error: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('[Places Autocomplete] Error:', error);
    throw error;
  }
}

/**
 * Get place details by place ID
 */
export async function getPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult> {
  try {
    const maps = await loadGoogleMaps();

    // Create a hidden div for the PlacesService
    const div = document.createElement('div');
    const service = new maps.places.PlacesService(div);

    return new Promise((resolve, reject) => {
      service.getDetails(
        {
          placeId,
          fields: ['geometry', 'formatted_address', 'name', 'place_id', 'address_components'],
        },
        (place, status) => {
          if (status === maps.places.PlacesServiceStatus.OK && place) {
            resolve(place);
          } else {
            reject(new Error(`Place Details error: ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('[Place Details] Error:', error);
    throw error;
  }
}
