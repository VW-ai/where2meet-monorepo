import { loadGoogleMaps } from '@/shared/lib/google-maps/loader';
import { pickPlaces, shortAddress, type PlaceSummary, type SearchArea } from './places';

const MAX_PLACES = 6;
const RESULTS_PER_QUERY = 6;
const SEARCH_RADIUS_METERS = 8000;
const PHOTO_MAX_WIDTH = 640;

/** Only what a card shows, since Google bills by field. */
const CARD_FIELDS = [
  'id',
  'displayName',
  'photos',
  'rating',
  'userRatingCount',
  'formattedAddress',
  'googleMapsURI',
  'primaryTypeDisplayName',
];

export async function searchPlaces(
  area: SearchArea,
  queries: readonly string[]
): Promise<PlaceSummary[]> {
  const { places } = await loadGoogleMaps();
  const responses = await Promise.all(
    queries.map((textQuery) =>
      places.Place.searchByText({
        textQuery,
        fields: CARD_FIELDS,
        locationBias: { center: area.center, radius: SEARCH_RADIUS_METERS },
        maxResultCount: RESULTS_PER_QUERY,
      })
    )
  );
  return pickPlaces(
    responses.map((response) => response.places.flatMap(toPlaceSummary)),
    MAX_PLACES
  );
}

/** The best match for a typed city name, or null when Google finds nothing. */
export async function findCity(query: string): Promise<SearchArea | null> {
  const { places } = await loadGoogleMaps();
  const {
    places: [city],
  } = await places.Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'location'],
    maxResultCount: 1,
  });
  if (!city?.location) return null;
  return { near: city.displayName ?? query, center: city.location.toJSON() };
}

/** A card needs a name and a Maps link, so places without them are dropped. */
function toPlaceSummary(place: google.maps.places.Place): PlaceSummary[] {
  if (!place.displayName || !place.googleMapsURI) return [];
  const photo = place.photos?.[0];
  return [
    {
      id: place.id,
      name: place.displayName,
      mapsUrl: place.googleMapsURI,
      type: place.primaryTypeDisplayName ?? null,
      address: place.formattedAddress ? shortAddress(place.formattedAddress) : null,
      rating:
        place.rating != null && place.userRatingCount
          ? { value: place.rating, count: place.userRatingCount }
          : null,
      photo: photo
        ? {
            url: photo.getURI({ maxWidth: PHOTO_MAX_WIDTH }),
            credits: photo.authorAttributions.map(({ displayName, uri }) => ({
              name: displayName,
              url: uri,
            })),
          }
        : null,
    },
  ];
}
