/**
 * Approximate area module.
 * @module utils/approximate-area
 */

import { createHmac } from "node:crypto";
import type { GeoPoint } from "./mec.js";

const MIN_DISTANCE_METERS = 800;
const MAX_DISTANCE_METERS = 1600;
const METERS_PER_LAT_DEGREE = 111_320;
const UINT48_RANGE = 2 ** 48;

const roundTo5Decimals = (degrees: number) => Math.round(degrees * 1e5) / 1e5;

/**
 * Picks the center of an approximate area 800 to 1,600 m from a point.
 *
 * The result is the same for the same point, rounded to 5 decimals, and the
 * same secret. Areas spread evenly over the ring's area and over directions.
 * @param exact - Geocoded point
 * @param secret - Key that picks the area
 * @returns Center of the approximate area
 */
export function approximateArea(exact: GeoPoint, secret: string): GeoPoint {
  const lat = roundTo5Decimals(exact.lat);
  const lng = roundTo5Decimals(exact.lng);
  const digest = createHmac("sha256", secret)
    .update(`approximate-area:v1:${lat.toFixed(5)},${lng.toFixed(5)}`)
    .digest();

  const bearing = 2 * Math.PI * (digest.readUIntBE(0, 6) / UINT48_RANGE);
  const distance = Math.sqrt(
    MIN_DISTANCE_METERS ** 2 +
      (digest.readUIntBE(6, 6) / UINT48_RANGE) *
        (MAX_DISTANCE_METERS ** 2 - MIN_DISTANCE_METERS ** 2)
  );

  return {
    lat: lat + (distance * Math.cos(bearing)) / METERS_PER_LAT_DEGREE,
    lng:
      lng +
      (distance * Math.sin(bearing)) / (METERS_PER_LAT_DEGREE * Math.cos((lat * Math.PI) / 180)),
  };
}
