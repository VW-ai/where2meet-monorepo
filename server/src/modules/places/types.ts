export interface PlaceSummary {
  id: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  hasPhoto: boolean;
}

export type Category =
  | "cafe"
  | "restaurant"
  | "bar"
  | "park"
  | "library"
  | "gym"
  | "museum"
  | "shopping"
  | "things_to_do";

type Categories = readonly [Category, ...Category[]];
export type SearchTerms =
  | { kind: "query"; query: string }
  | { kind: "categories"; categories: Categories }
  | { kind: "both"; query: string; categories: Categories };

export interface PlaceSearch {
  center: { lat: number; lng: number };
  radiusMeters: number;
  terms: SearchTerms;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  types: string[];
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  hasPhoto: boolean;
}

export interface PlaceDetails extends Place {
  formattedPhoneNumber: string | null;
  website: string | null;
  openingHours: string[] | null;
}

export type Lookup<T> =
  | { kind: "found"; value: T }
  | { kind: "not-found" }
  | { kind: "unavailable" };

export interface Places {
  summaries(ids: readonly string[]): Promise<ReadonlyMap<string, PlaceSummary>>;
  geocode(address: string): Promise<GeocodeResult>;
  search(input: PlaceSearch): Promise<{ kind: "found"; venues: Place[] } | { kind: "unavailable" }>;
  details(id: string): Promise<Lookup<PlaceDetails>>;
  destination(id: string): Promise<Lookup<{ lat: number; lng: number }>>;
  photo(id: string): Promise<Lookup<string>>;
}

export type GeocodeResult =
  | { kind: "found"; point: { lat: number; lng: number }; formattedAddress: string }
  | { kind: "not-found" }
  | { kind: "unavailable" };
