import type { Location } from '@/shared/types/map';

/** Where "Places to try" searches. `near` finishes its heading: "near Chicago", "near you". */
export interface SearchArea {
  near: string;
  center: Location;
}

export interface PhotoCredit {
  name: string;
  url: string | null;
}

/** One card's worth of a Google place, fetched live and never stored. */
export interface PlaceSummary {
  id: string;
  name: string;
  mapsUrl: string;
  type: string | null;
  address: string | null;
  rating: { value: number; count: number } | null;
  photo: { url: string; credits: PhotoCredit[] } | null;
}

/**
 * Takes results from each query in turn so every search shows up near the top,
 * drops repeats, then moves places without a photo to the end.
 */
export function pickPlaces(
  resultsByQuery: readonly (readonly PlaceSummary[])[],
  limit: number
): PlaceSummary[] {
  const byId = new Map<string, PlaceSummary>();
  const longest = Math.max(0, ...resultsByQuery.map((results) => results.length));
  for (let rank = 0; rank < longest; rank++) {
    for (const results of resultsByQuery) {
      const place = results[rank];
      if (place && !byId.has(place.id)) byId.set(place.id, place);
    }
  }
  const merged = [...byId.values()];
  return [
    ...merged.filter((place) => place.photo),
    ...merged.filter((place) => !place.photo),
  ].slice(0, limit);
}

const countFormat = new Intl.NumberFormat('en-US');

/** `4.6 (1,203)` */
export function formatRating({ value, count }: { value: number; count: number }): string {
  return `${value.toFixed(1)} (${countFormat.format(count)})`;
}

/** Drops the country and keeps the first two parts, usually the street and the city. */
export function shortAddress(formattedAddress: string): string {
  const parts = formattedAddress.split(', ');
  return (parts.length > 1 ? parts.slice(0, -1) : parts).slice(0, 2).join(', ');
}
