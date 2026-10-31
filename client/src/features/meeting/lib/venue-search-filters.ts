import type { VenueCategory } from '@/entities/venue/types';
import type { MapProvider } from '@/shared/types/map';

/**
 * The category chips search English words ("Cafe", "places to meet"). Google
 * understands them as text; AMap's keyword search mostly does not, so for AMap
 * events they become POI categories. Each category costs one AMap call.
 */
const AMAP_CATEGORY_QUERIES: Record<string, VenueCategory[]> = {
  'places to meet': ['cafe', 'restaurant'],
  cafe: ['cafe'],
  cafes: ['cafe'],
  coffee: ['cafe'],
  restaurant: ['restaurant'],
  restaurants: ['restaurant'],
  food: ['restaurant'],
  bar: ['bar'],
  bars: ['bar'],
  gym: ['gym'],
  park: ['park'],
  parks: ['park'],
  museum: ['museum'],
  museums: ['museum'],
  library: ['library'],
  shopping: ['shopping'],
  'things to do': ['things_to_do'],
};

/** The query or categories to send to POST /api/venues/search. */
export function venueSearchFilters(
  provider: MapProvider,
  query: string
): { query: string } | { categories: VenueCategory[] } {
  if (provider === 'amap') {
    const categories = AMAP_CATEGORY_QUERIES[query.trim().toLowerCase()];
    if (categories) return { categories };
  }
  return { query };
}
