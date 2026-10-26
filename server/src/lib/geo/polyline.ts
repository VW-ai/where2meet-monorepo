/**
 * Google encoded polyline algorithm.
 *
 * Route responses always carry polylines in this format, which the client
 * decodes. AMap returns plain "lng,lat;lng,lat" strings, so its routes are
 * re-encoded here after conversion to WGS-84.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * @module lib/geo/polyline
 */

import type { LatLng } from "./coords.js";

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while (v >= 0x20) {
    output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  output += String.fromCharCode(v + 63);
  return output;
}

/**
 * Encodes points with 5-decimal precision.
 * @param points - Path in order
 * @returns Encoded polyline string
 */
export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let output = "";
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    output += encodeValue(lat - lastLat) + encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return output;
}
