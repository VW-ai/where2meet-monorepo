/**
 * Venue-related type definitions
 */

import { Location } from '@/shared/types/map';

export interface VenueVote {
  venueId: string;
  userId: string;
  timestamp: number;
}

/**
 * Venue from backend API
 * Note: Backend returns `types[]` from Google Places, we derive `category` for display
 */
export interface Venue {
  id: string;
  name: string;
  address: string;
  location: Location;
  types: string[]; // Google Places types (from backend)
  rating: number | null;
  userRatingsTotal: number | null; // Number of reviews
  priceLevel: number | null; // 0-4 scale
  openNow: boolean | null;
  photoUrl: string | null;
  // Detail fields (from GET /venues/:id)
  formattedPhoneNumber?: string;
  website?: string;
  openingHours?: string[];
  // Frontend-only fields
  votes?: VenueVote[];
  voteCount?: number;
  isSaved?: boolean;
}

/**
 * Legacy Venue type for client-side operations (mock data, etc.)
 * @deprecated Use Venue with types[] instead
 */
export interface LegacyVenue {
  id: string;
  name: string;
  address: string;
  location: Location;
  category: VenueCategory;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  photos?: string[];
  openNow?: boolean;
  openingHours?: string[];
  phoneNumber?: string;
  website?: string;
  description?: string;
  votes?: VenueVote[];
  voteCount?: number;
  isSaved?: boolean;
}

export type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'gym'
  | 'park'
  | 'museum'
  | 'library'
  | 'shopping'
  | 'things_to_do';

export const VENUE_CATEGORIES: VenueCategory[] = [
  'cafe',
  'restaurant',
  'bar',
  'gym',
  'park',
  'museum',
  'library',
  'shopping',
  'things_to_do',
];

/**
 * Map our categories to Google Places types
 */
export const CATEGORY_TO_GOOGLE_TYPE: Record<VenueCategory, string> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  bar: 'bar',
  gym: 'gym',
  park: 'park',
  museum: 'museum',
  library: 'library',
  shopping: 'shopping_mall',
  things_to_do: 'tourist_attraction',
};

/**
 * Map Google Places types to our categories for display
 */
const GOOGLE_TYPE_TO_CATEGORY: Record<string, VenueCategory> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  bar: 'bar',
  gym: 'gym',
  park: 'park',
  museum: 'museum',
  library: 'library',
  shopping_mall: 'shopping',
  tourist_attraction: 'things_to_do',
};

/**
 * Derive the primary category from Google Places types array
 * Returns the first matching category, or 'things_to_do' as fallback
 */
export function getVenueCategory(types: string[]): VenueCategory {
  for (const type of types) {
    if (type in GOOGLE_TYPE_TO_CATEGORY) {
      return GOOGLE_TYPE_TO_CATEGORY[type];
    }
  }
  return 'things_to_do';
}

/**
 * Get display name for a venue's category
 */
export function getVenueCategoryDisplay(venue: Venue): string {
  const category = getVenueCategory(venue.types);
  return category.replace(/_/g, ' ');
}
