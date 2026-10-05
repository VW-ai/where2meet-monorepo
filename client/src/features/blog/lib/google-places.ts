import { loadGoogleMaps } from '@/shared/lib/google-maps/loader';
import { shortAddress, type PlaceSummary } from './places';

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
