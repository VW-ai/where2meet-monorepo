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
  'attributions',
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

/**
 * Card details for known place IDs, keyed by the ID asked for (Google may answer with a
 * newer one). A place Google can't return is left out, so its card can still show the
 * editor's words.
 */
export async function fetchPlaces(ids: readonly string[]): Promise<Map<string, PlaceSummary>> {
  const { places } = await loadGoogleMaps();
  const found = await Promise.all(
    ids.map(async (id) => {
      try {
        const place = new places.Place({ id });
        await place.fetchFields({ fields: CARD_FIELDS });
        return toPlaceSummary(place).map((summary) => [id, summary] as const);
      } catch (error) {
        console.error(`[places] Couldn't load place ${id}:`, error);
        return [];
      }
    })
  );
  return new Map(found.flat());
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
      providers: (place.attributions ?? []).flatMap(({ provider, providerURI }) =>
        provider ? [{ name: provider, url: providerURI }] : []
      ),
    },
  ];
}
