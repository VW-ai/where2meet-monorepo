import type { PrismaClient } from "@prisma/client";
import type { Places, PlaceSummary } from "./types.js";
import { createGeocoder } from "./geocoder.js";
import { createPlaceProvider, publicPlace } from "./provider.js";

export function createPlaces(
  database: PrismaClient,
  geocoding: Parameters<typeof createGeocoder>[0],
  providerOptions: Parameters<typeof createPlaceProvider>[0]
): Places {
  const provider = createPlaceProvider(providerOptions);
  return {
    geocode: createGeocoder(geocoding),
    search: (input) => provider.search(input),
    photo: (id) => provider.photo(id),
    async destination(id) {
      const result = await provider.details(id);
      return result.kind === "found" ? { kind: "found", value: result.value.location } : result;
    },
    async details(id) {
      const result = await provider.details(id);
      if (result.kind !== "found") return result;
      const place = publicPlace(result.value);
      const summary = {
        name: place.name,
        address: place.address || null,
        lat: place.location.lat,
        lng: place.location.lng,
        category: place.types[0] ?? null,
        rating: place.rating,
        priceLevel: place.priceLevel,
        photoUrl: place.hasPhoto ? `/api/venues/${encodeURIComponent(place.id)}/photo` : null,
      };
      await database.venue.upsert({ where: { id }, create: { id, ...summary }, update: summary });
      return { kind: "found", value: place };
    },
    async summaries(ids) {
      const rows = await database.venue.findMany({ where: { id: { in: [...ids] } } });
      return new Map<string, PlaceSummary>(
        rows.map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            address: row.address,
            location: { lat: row.lat.toNumber(), lng: row.lng.toNumber() },
            category: row.category,
            rating: row.rating?.toNumber() ?? null,
            priceLevel: row.priceLevel,
            hasPhoto: Boolean(row.photoUrl),
          },
        ])
      );
    },
  };
}
