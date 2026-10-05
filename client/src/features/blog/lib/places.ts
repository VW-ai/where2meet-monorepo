/** A photo author or a data provider that Google asks us to credit, linked when it has a page. */
export interface Credit {
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
  photo: { url: string; credits: Credit[] } | null;
  /** Third parties Google got some of this place's details from. */
  providers: Credit[];
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

/** Every data provider behind the shown places, once each. */
export function dataProviders(places: readonly PlaceSummary[]): Credit[] {
  const byName = new Map<string, Credit>();
  for (const provider of places.flatMap((place) => place.providers)) {
    if (!byName.has(provider.name)) byName.set(provider.name, provider);
  }
  return [...byName.values()];
}
