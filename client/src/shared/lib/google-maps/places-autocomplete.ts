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

function toPlacePrediction(prediction: google.maps.places.PlacePrediction): PlacePrediction {
  const text = prediction.text.text;
  return {
    place_id: prediction.placeId,
    description: text,
    main_text: prediction.mainText?.text ?? text,
    secondary_text: prediction.secondaryText?.text ?? '',
    full_address: text,
  };
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

  const maps = await loadGoogleMaps();
  const location = options?.location;
  const radius = options?.radius;
  const { suggestions } = await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: query,
    includedPrimaryTypes: options?.types,
    locationBias: location && radius ? { center: location, radius } : undefined,
  });

  return suggestions.flatMap(({ placePrediction }) =>
    placePrediction ? [toPlacePrediction(placePrediction)] : []
  );
}
