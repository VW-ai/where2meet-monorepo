/**
 * Venue-related type definitions
 */

import { Location } from './map';

export interface VenueVote {
  venueId: string;
  userId: string;
  timestamp: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  location: Location;
  category: VenueCategory;
  rating?: number;
  priceLevel?: number; // 1-4 scale
  photoUrl?: string;
  photos?: string[];
  openNow?: boolean;
  openingHours?: string[];
  phoneNumber?: string;
  website?: string;
  description?: string;
  votes?: VenueVote[];
  voteCount?: number;
  isSaved?: boolean; // Whether this venue is saved by the current user
}

export type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'gym'
  | 'park'
  | 'museum'
  | 'library'
  | 'things_to_do'
  | 'other';

export const VENUE_CATEGORIES: VenueCategory[] = [
  'cafe',
  'restaurant',
  'bar',
  'gym',
  'park',
  'museum',
  'library',
  'things_to_do',
  'other',
];
