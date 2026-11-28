/**
 * NYC Parks adapter. Reads the "NYC Parks Public Events - Upcoming 14 Days" dataset
 * (w3wp-dpdi) from NYC Open Data, which the city refreshes daily, and keeps the free
 * events that offer food or a talk.
 *
 * The listing has no price or food field, so both come from the description text.
 * The rules lean toward leaving an event out: a wrong pin costs more trust than a missing one.
 * @module services/free-events/nyc-parks
 */

import { z } from "zod";
import type { FreeEventKind, FreeEventRow, FreeEventSource, SourceFetchResult } from "./types.js";

export const NYC_PARKS_SOURCE = "nyc-parks";

/** One request covers the whole 14-day window, about 600 rows on 2026-11-28. */
const PAGE_LIMIT = 5000;
export const NYC_PARKS_URL = `https://data.cityofnewyork.us/resource/w3wp-dpdi.json?$limit=${String(PAGE_LIMIT)}`;
const FETCH_TIMEOUT_MS = 30_000;

const ParksRowSchema = z.object({
  guid: z.string().min(1).max(128),
  title: z.string().min(1),
  link: z.object({ url: z.url().max(1024) }),
  description: z.string().default(""),
  parknames: z.string().optional(),
  location: z.string().optional(),
  starttime: z.string(),
  endtime: z.string().optional(),
  categories: z.string().default(""),
  coordinates: z.string().optional(),
});
type ParksRow = z.infer<typeof ParksRowSchema>;

const PRICE = /\$\s?\d/;
const CANCELLED = /^\s*cancell?ed\b/i;
const HACKATHON = /\bhackathon\b/i;
const TALK_TITLE = /\b(talk|lecture)s?\b/i;
const FOOD =
  /\b(snacks?|refreshments?|pizza|lunch|breakfast|dinner|cookies|hot cocoa|hot chocolate|cider|food|treats)\b/i;
const FOOD_TITLE = /\b(hot cocoa|hot chocolate|pizza|potluck|pancakes?|bbq)\b/i;
/** A food word only counts in a sentence that says the food is given out. */
const FOOD_GIVEN = /\b(served|provided|complimentary|free|enjoy|included)\b/i;
/** Food the visitor brings, donates or buys is not free food. */
const FOOD_NOT_GIVEN = /\b(bring|donat\w*|scraps|vendors?|sold|purchase)\b/i;

/** NYC's five boroughs fit inside this box; a coordinate outside it is a typo. */
const NYC_BOUNDS = { minLat: 40.4, maxLat: 41.0, minLng: -74.3, maxLng: -73.6 };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) {
      return String.fromCodePoint(parseInt(code.slice(1), 10));
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** New York's UTC offset at an instant, in ms (negative, e.g. -5 h in winter). */
function nyOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    nyFormatter.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value])
  );
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return wall - (utcMs - (utcMs % 1000));
}

/**
 * Converts a New York wall-clock time with no zone, as the dataset writes it
 * ("2026-12-02T17:30:00.000"), to the instant it names.
 * @param local - Wall-clock time in New York
 * @returns The instant, or null when the text is not a date-time
 */
export function nyLocalToUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(local);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = m;
  const asUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0)
  );
  // The offset depends on the instant, so take it twice to settle across a DST change.
  const guess = asUtc - nyOffsetMs(asUtc);
  return new Date(asUtc - nyOffsetMs(guess));
}

function parseCoordinates(text: string | undefined): { lat: number; lng: number } | null {
  const [lat, lng] = (text ?? "").split(",").map((part) => Number(part.trim()));
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const inNyc =
    lat >= NYC_BOUNDS.minLat &&
    lat <= NYC_BOUNDS.maxLat &&
    lng >= NYC_BOUNDS.minLng &&
    lng <= NYC_BOUNDS.maxLng;
  return inNyc ? { lat, lng } : null;
}

/** Events in a community garden or office have no park name, only a location. */
function venueName(row: ParksRow): string | null {
  const name = row.parknames ?? row.location;
  return name ? decodeEntities(name).slice(0, 255) : null;
}

function offersFood(title: string, description: string): boolean {
  if (FOOD_TITLE.test(title)) {
    return true;
  }
  return description
    .split(/[.!?]+/)
    .some(
      (sentence) =>
        FOOD.test(sentence) && FOOD_GIVEN.test(sentence) && !FOOD_NOT_GIVEN.test(sentence)
    );
}

/**
 * Picks the kind a Parks listing belongs to, or null when it is paid or fits none.
 * Free food wins over a talk, since food is the rarer pin.
 * @param row - One validated dataset row
 * @returns The kind, or null to leave the row out
 */
export function classifyParksEvent(row: ParksRow): FreeEventKind | null {
  const title = decodeEntities(row.title).replace(CANCELLED, "");
  const description = decodeEntities(row.description);
  if (PRICE.test(description)) {
    return null;
  }
  if (HACKATHON.test(title)) {
    return "hackathon";
  }
  if (offersFood(title, description)) {
    return "free-food";
  }
  const categories = row.categories.split("|").map((category) => category.trim());
  if (categories.includes("Talks") || TALK_TITLE.test(title)) {
    return "free-talk";
  }
  return null;
}

/**
 * Maps the raw dataset response to event rows.
 * @param raw - The parsed JSON body of the dataset request
 * @returns The rows to store and how many listings were left out
 * @throws Error when the body is not a list, which means the dataset changed shape
 */
export function mapParksEvents(raw: unknown): SourceFetchResult {
  if (!Array.isArray(raw)) {
    throw new Error("NYC Parks response is not a list");
  }
  const rows: FreeEventRow[] = [];
  for (const item of raw) {
    const parsed = ParksRowSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    const row = parsed.data;
    const kind = classifyParksEvent(row);
    const startsAt = nyLocalToUtc(row.starttime);
    if (!kind || !startsAt) {
      continue;
    }
    const title = decodeEntities(row.title).trim();
    const point = parseCoordinates(row.coordinates);
    rows.push({
      sourceId: row.guid,
      title: title
        .replace(CANCELLED, "")
        .replace(/^[\s:–-]+/, "")
        .slice(0, 255),
      startsAt,
      endsAt: row.endtime ? nyLocalToUtc(row.endtime) : null,
      venueName: venueName(row),
      placeId: null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      kind,
      url: row.link.url.replace(/^http:\/\//, "https://"),
      cancelled: CANCELLED.test(title),
    });
  }
  return { rows, skipped: raw.length - rows.length };
}

/**
 * Builds the NYC Parks source.
 * @param url - Dataset URL; tests and drills point it elsewhere
 * @returns The source the ingest job runs
 */
export function nycParksSource(url: string = NYC_PARKS_URL): FreeEventSource {
  return {
    name: NYC_PARKS_SOURCE,
    async fetchRows() {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`NYC Parks answered ${String(response.status)}`);
      }
      const body: unknown = await response.json();
      if (Array.isArray(body) && body.length >= PAGE_LIMIT) {
        throw new Error(`NYC Parks returned ${String(PAGE_LIMIT)} rows, the page limit; raise it`);
      }
      return mapParksEvents(body);
    },
  };
}
