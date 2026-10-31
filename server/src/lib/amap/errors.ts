/**
 * AMap infocode handling.
 *
 * AMap reports errors as an infocode with HTTP 200. Each code is translated to
 * the Google-style status the shared error classes and services already
 * understand: OVER_QUERY_LIMIT is retried, NOT_FOUND / INVALID_REQUEST mark a
 * bad venue ID, ZERO_RESULTS means no route.
 * @see https://lbs.amap.com/api/webservice/guide/tools/info
 * @module lib/amap/errors
 */

/** Per-minute and QPS limits: worth retrying with backoff. */
const RATE_LIMITED = new Set([
  "10004",
  "10014",
  "10015",
  "10016",
  "10019",
  "10020",
  "10021",
  "10029",
]);

/** Daily quota or paid plan used up: retrying today cannot help. */
const QUOTA_EXHAUSTED = new Set(["10003", "10044", "10045", "40000", "40002", "40003"]);

/** Key, permission or account problems. */
const DENIED = new Set([
  "10001",
  "10002",
  "10005",
  "10006",
  "10007",
  "10009",
  "10010",
  "10012",
  "10013",
  "10026",
  "20011",
]);

/** Malformed requests, including unknown POI IDs. */
const INVALID = new Set(["20000", "20001", "20002", "20012"]);

/** Route planning failures: outside mainland China, no road nearby, unreachable, too far. */
const NO_ROUTE = new Set(["20800", "20801", "20802", "20803"]);

/**
 * Translates an AMap infocode to a Google-style status.
 * @param infocode - AMap infocode (absent on some v3 errors)
 * @returns Status string for PlacesApiError / GeocodingApiError / DirectionsApiError
 */
export function statusForInfocode(infocode: string | undefined): string {
  if (infocode === undefined) return "UNKNOWN_ERROR";
  if (RATE_LIMITED.has(infocode)) return "OVER_QUERY_LIMIT";
  if (QUOTA_EXHAUSTED.has(infocode)) return "OVER_DAILY_LIMIT";
  if (DENIED.has(infocode)) return "REQUEST_DENIED";
  if (INVALID.has(infocode)) return "INVALID_REQUEST";
  if (NO_ROUTE.has(infocode)) return "ZERO_RESULTS";
  return "UNKNOWN_ERROR";
}

/** Error factory so each caller throws its own shared error class. */
export type AmapErrorFactory = (message: string, status: string) => Error;
