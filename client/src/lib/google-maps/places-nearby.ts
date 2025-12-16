/**
 * Google Places Nearby Search Service
 *
 * Provides nearby venue search functionality
 */

import { loadGoogleMaps } from './loader';
import { Venue, VenueCategory, Location } from '@/types';

// Extended PlaceResult type to include editorial_summary
interface ExtendedPlaceResult extends google.maps.places.PlaceResult {
  editorial_summary?: {
    overview?: string;
  };
}

// Map our internal categories to Google Places types
const CATEGORY_TO_GOOGLE_TYPE: Record<VenueCategory, string> = {
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
 * Convert Google Place to our Venue type
 */
function convertPlaceToVenue(
  place: google.maps.places.PlaceResult,
  category: VenueCategory
): Venue {
  const extendedPlace = place as ExtendedPlaceResult;
  return {
    id: place.place_id || `place_${Date.now()}`,
    name: place.name || 'Unknown',
    address: place.formatted_address || place.vicinity || '',
    location: {
      lat: place.geometry?.location?.lat() || 0,
      lng: place.geometry?.location?.lng() || 0,
    },
    category,
    rating: place.rating,
    priceLevel: place.price_level,
    photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }),
    photos: place.photos?.slice(0, 5).map((photo) => photo.getUrl({ maxWidth: 800 })),
    openNow: place.opening_hours?.isOpen(),
    openingHours: place.opening_hours?.weekday_text,
    phoneNumber: place.formatted_phone_number,
    website: place.website,
    description: extendedPlace.editorial_summary?.overview,
  };
}

/**
 * Search for nearby venues using Google Places API
 */
export async function searchNearbyPlaces(
  center: Location,
  radius: number,
  categories?: VenueCategory[]
): Promise<Venue[]> {
  try {
    const maps = await loadGoogleMaps();

    // Create a hidden div for the PlacesService
    const div = document.createElement('div');
    const service = new maps.places.PlacesService(div);

    const location = new maps.LatLng(center.lat, center.lng);

    // If no categories specified, search for all
    const typesToSearch =
      categories && categories.length > 0
        ? categories.map((cat) => CATEGORY_TO_GOOGLE_TYPE[cat])
        : Object.values(CATEGORY_TO_GOOGLE_TYPE);

    // Search for each category
    const searchPromises = typesToSearch.map((type) => {
      return new Promise<Venue[]>((resolve) => {
        const request: google.maps.places.PlaceSearchRequest = {
          location,
          radius,
          type,
        };

        service.nearbySearch(request, (results, status) => {
          if (status === maps.places.PlacesServiceStatus.OK && results) {
            // Find matching category for this type
            const category =
              (Object.keys(CATEGORY_TO_GOOGLE_TYPE) as VenueCategory[]).find(
                (cat) => CATEGORY_TO_GOOGLE_TYPE[cat] === type
              ) || 'things_to_do';

            const venues = results.map((place) => convertPlaceToVenue(place, category));
            resolve(venues);
          } else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            console.warn(`[Nearby Search] Error for type ${type}:`, status);
            resolve([]); // Don't reject, just return empty results for this type
          }
        });
      });
    });

    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);

    // Flatten and deduplicate results
    const allVenues = results.flat();
    const uniqueVenues = Array.from(new Map(allVenues.map((venue) => [venue.id, venue])).values());

    return uniqueVenues;
  } catch (error) {
    console.error('[Nearby Search] Error:', error);
    throw error;
  }
}

/**
 * Search for venues by text query
 */
export async function searchPlacesByText(
  query: string,
  location?: Location,
  radius?: number
): Promise<Venue[]> {
  try {
    const maps = await loadGoogleMaps();

    // Create a hidden div for the PlacesService
    const div = document.createElement('div');
    const service = new maps.places.PlacesService(div);

    const request: google.maps.places.TextSearchRequest = {
      query,
      ...(location && { location: new maps.LatLng(location.lat, location.lng) }),
      ...(radius && { radius }),
    };

    return new Promise((resolve, reject) => {
      service.textSearch(request, (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && results) {
          // Try to infer category from types
          const venues = results.map((place) => {
            let category: VenueCategory = 'things_to_do';

            if (place.types) {
              for (const [cat, googleType] of Object.entries(CATEGORY_TO_GOOGLE_TYPE)) {
                if (place.types.includes(googleType)) {
                  category = cat as VenueCategory;
                  break;
                }
              }
            }

            return convertPlaceToVenue(place, category);
          });
          resolve(venues);
        } else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Text Search error: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('[Text Search] Error:', error);
    throw error;
  }
}

/**
 * Get detailed information about a place
 */
export async function getPlaceDetails(placeId: string): Promise<Partial<Venue>> {
  try {
    const maps = await loadGoogleMaps();

    // Create a hidden div for the PlacesService
    const div = document.createElement('div');
    const service = new maps.places.PlacesService(div);

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId,
      fields: [
        'opening_hours',
        'editorial_summary',
        'formatted_phone_number',
        'website',
        'photos',
        'rating',
        'user_ratings_total',
      ],
    };

    return new Promise((resolve, reject) => {
      service.getDetails(request, (place, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && place) {
          const details: Partial<Venue> = {
            openingHours: place.opening_hours?.weekday_text,
            openNow: place.opening_hours?.isOpen(),
            description: (place as ExtendedPlaceResult).editorial_summary?.overview,
            phoneNumber: place.formatted_phone_number,
            website: place.website,
            photos: place.photos?.slice(0, 5).map((photo) => photo.getUrl({ maxWidth: 800 })),
          };
          resolve(details);
        } else {
          reject(new Error(`Place Details error: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('[Place Details] Error:', error);
    throw error;
  }
}
