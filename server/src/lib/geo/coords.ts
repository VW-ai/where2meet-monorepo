/**
 * Conversion between WGS-84 and GCJ-02 coordinates.
 *
 * Where2Meet stores every coordinate in WGS-84 (GPS), the system Google uses.
 * Chinese map providers such as AMap require GCJ-02, which shifts points inside
 * mainland China by roughly 300-500 m. Converting only at the AMap boundary keeps
 * the database, MEC calculation and cache keys in one system.
 * @module lib/geo/coords
 */

/** A latitude/longitude pair in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Krasovsky 1940 ellipsoid, which GCJ-02 is defined on. */
const SEMI_MAJOR_AXIS = 6378245.0;
const ECCENTRICITY_SQUARED = 0.006693421622965943;

/**
 * Rough bounding box of mainland China.
 *
 * Outside it GCJ-02 equals WGS-84, so the offset must not be applied. The box is
 * the one published GCJ-02 implementations use; it also covers parts of
 * neighbouring countries, where AMap has little data anyway.
 */
export function isOutsideChina(point: LatLng): boolean {
  return point.lng < 72.004 || point.lng > 137.8347 || point.lat < 0.8293 || point.lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

/** The GCJ-02 offset to add to a WGS-84 point. */
function gcjOffset(point: LatLng): LatLng {
  const x = point.lng - 105.0;
  const y = point.lat - 35.0;
  const radLat = (point.lat / 180.0) * Math.PI;
  const sinLat = Math.sin(radLat);
  const magic = 1 - ECCENTRICITY_SQUARED * sinLat * sinLat;
  const sqrtMagic = Math.sqrt(magic);
  const dLat =
    (transformLat(x, y) * 180.0) /
    (((SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic)) * Math.PI);
  const dLng =
    (transformLng(x, y) * 180.0) / ((SEMI_MAJOR_AXIS / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: dLat, lng: dLng };
}

/**
 * Converts a WGS-84 point to GCJ-02.
 * @param point - WGS-84 coordinates
 * @returns GCJ-02 coordinates (unchanged outside mainland China)
 */
export function wgs84ToGcj02(point: LatLng): LatLng {
  if (isOutsideChina(point)) {
    return { lat: point.lat, lng: point.lng };
  }
  const offset = gcjOffset(point);
  return { lat: point.lat + offset.lat, lng: point.lng + offset.lng };
}

/**
 * Converts a GCJ-02 point back to WGS-84.
 *
 * GCJ-02 has no closed-form inverse, so this refines the guess until the forward
 * transform lands within ~1 cm of the input. A few iterations are enough.
 * @param point - GCJ-02 coordinates
 * @returns WGS-84 coordinates (unchanged outside mainland China)
 */
export function gcj02ToWgs84(point: LatLng): LatLng {
  if (isOutsideChina(point)) {
    return { lat: point.lat, lng: point.lng };
  }
  const threshold = 1e-7;
  let guess: LatLng = { lat: point.lat, lng: point.lng };
  for (let i = 0; i < 10; i++) {
    const forward = wgs84ToGcj02(guess);
    const dLat = forward.lat - point.lat;
    const dLng = forward.lng - point.lng;
    if (Math.abs(dLat) < threshold && Math.abs(dLng) < threshold) {
      break;
    }
    guess = { lat: guess.lat - dLat, lng: guess.lng - dLng };
  }
  return guess;
}
