import type { PrismaClient } from "@prisma/client";
import type { Places, PlaceSummary } from "./types.js";

export function createPlaces(database: PrismaClient): Places {
  return {
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
