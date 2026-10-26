/**
 * Conversions between AMap wire formats and Where2Meet values.
 *
 * AMap takes and returns GCJ-02 "lng,lat" strings; Where2Meet uses WGS-84
 * objects. Every coordinate crossing the AMap boundary goes through here.
 * @module lib/amap/parse
 */

import { gcj02ToWgs84, wgs84ToGcj02, type LatLng } from "../geo/coords.js";
import type { AmapPolyline, AmapText } from "./types.js";

/** Venue ID prefix that marks a POI as AMap's. */
const AMAP_VENUE_ID_PREFIX = "amap:";

/**
 * Reads a v3 string field, which AMap sends as [] when empty.
 * @param value - Raw field
 * @returns The string, or "" when empty or missing
 */
export function text(value: AmapText | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Formats a WGS-84 point as an AMap GCJ-02 location parameter.
 * @param point - WGS-84 coordinates
 * @returns "lng,lat" with AMap's maximum of 6 decimals
 */
export function toAmapLocation(point: LatLng): string {
  const gcj = wgs84ToGcj02(point);
  return `${gcj.lng.toFixed(6)},${gcj.lat.toFixed(6)}`;
}

/**
 * Parses an AMap GCJ-02 "lng,lat" location into WGS-84.
 * @param value - Raw location field
 * @returns WGS-84 coordinates, or null when the field is empty or malformed
 */
export function fromAmapLocation(value: AmapText | undefined): LatLng | null {
  const raw = text(value);
  const [lngText, latText] = raw.split(",");
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!lngText || !latText || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return gcj02ToWgs84({ lat, lng });
}

/**
 * Parses an AMap "lng,lat;lng,lat" polyline into WGS-84 points.
 * @param polyline - A string, or v5 transit's { polyline } wrapper
 * @returns Points in order; malformed points are skipped
 */
export function fromAmapPolyline(polyline: AmapPolyline | undefined): LatLng[] {
  const raw = typeof polyline === "string" ? polyline : (polyline?.polyline ?? "");
  return raw
    .split(";")
    .map((point) => fromAmapLocation(point))
    .filter((point): point is LatLng => point !== null);
}

/**
 * Builds the Where2Meet venue ID for an AMap POI.
 * @param poiId - AMap POI ID, e.g. "B000A7BM4H"
 * @returns "amap:B000A7BM4H"
 */
export function toAmapVenueId(poiId: string): string {
  return `${AMAP_VENUE_ID_PREFIX}${poiId}`;
}

/**
 * Checks whether a venue ID was issued by AMap.
 * @param venueId - Any venue ID
 */
export function isAmapVenueId(venueId: string): boolean {
  return venueId.startsWith(AMAP_VENUE_ID_PREFIX);
}

/**
 * Extracts the AMap POI ID from a venue ID.
 * @param venueId - "amap:<POI id>"
 * @returns The POI ID
 */
export function fromAmapVenueId(venueId: string): string {
  return venueId.slice(AMAP_VENUE_ID_PREFIX.length);
}
