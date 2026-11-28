/**
 * Where each place is, asked live from Google by place ID, as the blog cards ask for
 * photos. Google's terms let us keep the ID but not the coordinates, so they are never
 * stored. A place Google marks permanently closed is left off the map.
 */
export async function fetchLocations(
  maps: typeof google.maps,
  ids: readonly string[]
): Promise<Map<string, google.maps.LatLngLiteral>> {
  const found = await Promise.all(
    ids.map(async (id) => {
      try {
        const place = new maps.places.Place({ id });
        await place.fetchFields({ fields: ['location', 'businessStatus'] });
        if (!place.location) return [];
        if (place.businessStatus === maps.places.BusinessStatus.CLOSED_PERMANENTLY) return [];
        return [[id, place.location.toJSON()] as const];
      } catch (error) {
        console.error(`[nyc-map] Couldn't locate place ${id}:`, error);
        return [];
      }
    })
  );
  return new Map(found.flat());
}
