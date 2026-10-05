export interface PlaceSummary {
  id: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  photoUrl: string | null;
}

export interface Places {
  summaries(ids: readonly string[]): Promise<ReadonlyMap<string, PlaceSummary>>;
  geocode(address: string): Promise<GeocodeResult>;
}

export type GeocodeResult =
  | { kind: "found"; point: { lat: number; lng: number }; formattedAddress: string }
  | { kind: "not-found" }
  | { kind: "unavailable" };
