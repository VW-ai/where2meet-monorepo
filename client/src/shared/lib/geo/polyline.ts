/**
 * Decoder for Google's encoded polyline format.
 *
 * Route responses carry polylines in this format for both map providers. The
 * Google map decodes them with its geometry library; the AMap map has no such
 * library, so it uses this.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

import type { LatLng } from './coords';

/**
 * Decodes a polyline with 5-decimal precision.
 * @param encoded - Encoded polyline string
 * @returns Points in order
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const nextValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += nextValue();
    lng += nextValue();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
