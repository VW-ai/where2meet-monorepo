/**
 * Type definitions for Google Places API.
 * @module lib/places/types
 */

/** Supported venue categories mapped to Google Place types */
export const CATEGORY_TO_PLACE_TYPE: Record<string, string> = {
  cafe: "cafe",
  restaurant: "restaurant",
  bar: "bar",
  park: "park",
  library: "library",
  gym: "gym",
  museum: "museum",
  shopping: "shopping_mall",
  things_to_do: "tourist_attraction",
};

/** Supported category names */
export type VenueCategory = keyof typeof CATEGORY_TO_PLACE_TYPE;

/** Geographic point for search center */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Place result from Google Places API (normalized).
 */
export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  location: GeoPoint;
  types: string[];
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  photoReference: string | null;
}

/**
 * Detailed place information from Place Details API.
 */
export interface PlaceDetails extends PlaceResult {
  formattedPhoneNumber: string | null;
  website: string | null;
  openingHours: string[] | null;
}

// ============================================================================
// Google API Response Types (internal)
// ============================================================================

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: { photo_reference: string }[];
  formatted_phone_number?: string;
  website?: string;
}

export interface GooglePlacesSearchResponse {
  status: string;
  results: GooglePlaceResult[];
  error_message?: string;
  next_page_token?: string;
}

export interface GooglePlaceDetailsResponse {
  status: string;
  result?: GooglePlaceResult;
  error_message?: string;
}
