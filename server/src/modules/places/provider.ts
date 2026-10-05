import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { ProviderCache } from "../../cache.js";
import type { Category, Lookup, Place, PlaceSearch } from "./types.js";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const nullableNumber = z.number().min(0).max(5).nullable();
const normalizedPlace = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  address: z.string().max(255),
  location: point,
  types: z.array(z.string().min(1).max(50)),
  rating: nullableNumber,
  userRatingsTotal: z.number().int().nonnegative().nullable(),
  priceLevel: z.number().int().min(0).max(4).nullable(),
  openNow: z.boolean().nullable(),
  photoReference: z.string().min(1).max(8192).nullable(),
});
const normalizedDetails = normalizedPlace.extend({
  formattedPhoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  openingHours: z.array(z.string()).nullable(),
});
type NormalizedPlace = z.infer<typeof normalizedPlace>;
type NormalizedDetails = z.infer<typeof normalizedDetails>;

const googlePlace = z.object({
  place_id: normalizedPlace.shape.id,
  name: normalizedPlace.shape.name,
  vicinity: z.string().max(255).optional(),
  formatted_address: z.string().max(255).optional(),
  geometry: z.object({ location: point }),
  types: normalizedPlace.shape.types.default([]),
  rating: nullableNumber.optional(),
  user_ratings_total: normalizedPlace.shape.userRatingsTotal.optional(),
  price_level: normalizedPlace.shape.priceLevel.optional(),
  opening_hours: z
    .object({
      open_now: z.boolean().optional(),
      weekday_text: z.array(z.string()).optional(),
    })
    .optional(),
  photos: z.array(z.object({ photo_reference: z.string().min(1).max(8192) })).optional(),
});
const googleDetails = googlePlace.extend({
  formatted_phone_number: z.string().optional(),
  website: z.string().optional(),
});
const status = z.object({ status: z.string() });
const searchResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("OK"), results: z.array(googlePlace) }),
  z.object({ status: z.literal("ZERO_RESULTS"), results: z.array(z.unknown()).length(0) }),
]);
const detailsResponse = z.object({ status: z.literal("OK"), result: googleDetails });
const categoryTypes: Record<Category, string> = {
  cafe: "cafe",
  restaurant: "restaurant",
  bar: "bar",
  park: "park",
  library: "library",
  gym: "gym",
  museum: "museum",
  shopping: "shopping_mall",
  things_to_do: "tourist_attraction",
};
const fields =
  "place_id,name,vicinity,formatted_address,geometry,types,rating,user_ratings_total,price_level,opening_hours,photos,formatted_phone_number,website";

function normalize(value: z.infer<typeof googlePlace>): NormalizedPlace {
  return {
    id: value.place_id,
    name: value.name,
    address: value.vicinity ?? value.formatted_address ?? "",
    location: value.geometry.location,
    types: value.types,
    rating: value.rating ?? null,
    userRatingsTotal: value.user_ratings_total ?? null,
    priceLevel: value.price_level ?? null,
    openNow: value.opening_hours?.open_now ?? null,
    photoReference: value.photos?.[0]?.photo_reference ?? null,
  };
}

export function publicPlace<T extends NormalizedPlace>(value: T) {
  const { photoReference, ...place } = value;
  return { ...place, hasPhoto: photoReference !== null };
}

export function createPlaceProvider(options: {
  apiKey: string;
  endpoint: string;
  cache: ProviderCache;
  timeoutMs: number;
  searchTimeoutMs: number;
  photoTimeoutMs: number;
  searchTtlSeconds: number;
  detailsTtlSeconds: number;
}) {
  const key = (operation: string, inputs: unknown) =>
    `m3:places:${operation}:v1:${createHash("sha256")
      .update(JSON.stringify([options.endpoint, inputs]))
      .digest("hex")}`;

  async function read<T>(
    cacheKey: string,
    schema: z.ZodType<T>,
    signal: AbortSignal
  ): Promise<T | null> {
    const text = await options.cache.read(cacheKey, signal);
    if (text === null) return null;
    try {
      const value: unknown = JSON.parse(text);
      const parsed = z.object({ version: z.literal(1), value: schema }).safeParse(value);
      return parsed.success ? parsed.data.value : null;
    } catch {
      return null;
    }
  }

  async function write(cacheKey: string, value: unknown, ttl: number, signal: AbortSignal) {
    await options.cache.write(cacheKey, JSON.stringify({ version: 1, value }), ttl, signal);
  }

  async function request(url: URL, signal: AbortSignal): Promise<unknown> {
    if (!options.apiKey || signal.aborted) return null;
    url.searchParams.set("key", options.apiKey);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, { signal, redirect: "error" });
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status !== 429 && response.status < 500) return null;
          } else {
            const text = await response.text();
            let payload: unknown;
            try {
              payload = JSON.parse(text);
            } catch {
              return null;
            }
            const parsed = status.safeParse(payload);
            if (!parsed.success) return null;
            if (!["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"].includes(parsed.data.status)) return payload;
          }
        } catch {
          signal.throwIfAborted();
        }
        if (attempt < 2) await delay(attempt === 0 ? 100 : 400, undefined, { signal });
      }
    } catch {
      return null;
    }
    return null;
  }

  async function details(id: string, outer?: AbortSignal): Promise<Lookup<NormalizedDetails>> {
    const own = AbortSignal.timeout(options.timeoutMs);
    const signal = outer ? AbortSignal.any([outer, own]) : own;
    const cacheKey = key("details", [id, fields]);
    const cached = await read(cacheKey, normalizedDetails, signal);
    if (cached?.id === id) return { kind: "found", value: cached };
    const url = new URL("details/json", options.endpoint);
    url.searchParams.set("place_id", id);
    url.searchParams.set("fields", fields);
    const payload = await request(url, signal);
    const parsedStatus = status.safeParse(payload);
    if (
      parsedStatus.success &&
      ["NOT_FOUND", "ZERO_RESULTS", "INVALID_REQUEST"].includes(parsedStatus.data.status)
    )
      return { kind: "not-found" };
    const parsed = detailsResponse.safeParse(payload);
    if (!parsed.success || parsed.data.result.place_id !== id) return { kind: "unavailable" };
    const result = parsed.data.result;
    const value: NormalizedDetails = {
      ...normalize(result),
      formattedPhoneNumber: result.formatted_phone_number ?? null,
      website: result.website ?? null,
      openingHours: result.opening_hours?.weekday_text ?? null,
    };
    await write(cacheKey, value, options.detailsTtlSeconds, signal);
    return { kind: "found", value };
  }

  async function searchPart(
    input: PlaceSearch,
    term: { query: string } | { category: Category },
    outer: AbortSignal
  ): Promise<Place[] | null> {
    const signal = AbortSignal.any([outer, AbortSignal.timeout(options.timeoutMs)]);
    const endpoint = "query" in term ? "textsearch/json" : "nearbysearch/json";
    const cacheKey = key("search", [
      endpoint,
      input.center.lat,
      input.center.lng,
      input.radiusMeters,
      term,
    ]);
    const cached = await read(cacheKey, z.array(normalizedPlace), signal);
    if (cached) return cached.map(publicPlace);
    const url = new URL(endpoint, options.endpoint);
    url.searchParams.set("location", `${String(input.center.lat)},${String(input.center.lng)}`);
    url.searchParams.set("radius", String(input.radiusMeters));
    if ("query" in term) url.searchParams.set("query", term.query);
    else url.searchParams.set("type", categoryTypes[term.category]);
    const parsed = searchResponse.safeParse(await request(url, signal));
    if (!parsed.success) return null;
    const values = parsed.data.status === "ZERO_RESULTS" ? [] : parsed.data.results.map(normalize);
    await write(cacheKey, values, options.searchTtlSeconds, signal);
    return values.map(publicPlace);
  }

  return {
    details,
    async search(
      input: PlaceSearch
    ): Promise<{ kind: "found"; venues: Place[] } | { kind: "unavailable" }> {
      const cancellation = new AbortController();
      const signal = AbortSignal.any([
        cancellation.signal,
        AbortSignal.timeout(options.searchTimeoutMs),
      ]);
      const terms: ({ query: string } | { category: Category })[] = [];
      if (input.terms.kind !== "categories") terms.push({ query: input.terms.query });
      if (input.terms.kind !== "query")
        for (const category of new Set(input.terms.categories)) terms.push({ category });
      const results: (Place[] | null)[] = terms.map(() => null);
      const work = terms.entries();
      async function worker() {
        for (const [index, term] of work) {
          if (signal.aborted) return;
          results[index] = await searchPart(input, term, signal);
          if (results[index] === null) {
            cancellation.abort();
            return;
          }
        }
      }
      await Promise.all([worker(), worker()]);
      if (results.some((result) => result === null)) return { kind: "unavailable" };
      const places = new Map<string, Place>();
      for (const result of results)
        for (const place of result ?? []) if (!places.has(place.id)) places.set(place.id, place);
      const venues = [...places.values()].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      return { kind: "found", venues };
    },
    async photo(id: string): Promise<Lookup<string>> {
      const signal = AbortSignal.timeout(options.photoTimeoutMs);
      const result = await details(id, signal);
      if (result.kind !== "found") return result;
      if (result.value.photoReference === null) return { kind: "not-found" };
      const url = new URL("photo", options.endpoint);
      url.searchParams.set("photoreference", result.value.photoReference);
      url.searchParams.set("maxwidth", "400");
      url.searchParams.set("key", options.apiKey);
      if (!options.apiKey) return { kind: "unavailable" };
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, { signal, redirect: "manual" });
            await response.body?.cancel();
            if (response.status !== 429 && response.status < 500) {
              const location = response.headers.get("location");
              if (response.status !== 302 || !location) return { kind: "unavailable" };
              try {
                const target = new URL(location);
                if (
                  target.protocol !== "https:" ||
                  target.hostname !== "lh3.googleusercontent.com" ||
                  target.port ||
                  target.username ||
                  target.password ||
                  target.search ||
                  target.hash
                )
                  return { kind: "unavailable" };
                let candidate = target.href;
                let decoded = decodeURIComponent(candidate);
                while (decoded !== candidate) {
                  candidate = decoded;
                  decoded = decodeURIComponent(candidate);
                }
                if (decoded.includes(options.apiKey)) return { kind: "unavailable" };
                return { kind: "found", value: target.href };
              } catch {
                return { kind: "unavailable" };
              }
            }
          } catch {
            signal.throwIfAborted();
          }
          if (attempt < 2) await delay(attempt === 0 ? 100 : 400, undefined, { signal });
        }
      } catch {
        return { kind: "unavailable" };
      }
      return { kind: "unavailable" };
    },
  };
}
