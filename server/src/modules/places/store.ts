import type { PrismaClient } from "@prisma/client";
import type { Places, PlaceSummary } from "./types.js";
import { createGeocoder } from "./geocoder.js";

export function createPlaces(
  database: PrismaClient,
  geocoding: Parameters<typeof createGeocoder>[0]
): Places {
  return {
    geocode: createGeocoder(geocoding),
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
            photoUrl: row.photoUrl,
          },
        ])
      );
    },
  };
}
