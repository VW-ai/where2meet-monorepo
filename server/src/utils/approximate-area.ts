import { createHmac } from "node:crypto";
import type { GeoPoint } from "./mec.js";

const MIN_DISTANCE_METERS = 800;
const MAX_DISTANCE_METERS = 1600;
const METERS_PER_LAT_DEGREE = 111_320;
const UINT48_RANGE = 2 ** 48;

const roundTo5Decimals = (degrees: number) => Math.round(degrees * 1e5) / 1e5;

// Even over the ring's area, not its radius.
const distanceInRing = (fraction: number) =>
  Math.sqrt(
    MIN_DISTANCE_METERS ** 2 + fraction * (MAX_DISTANCE_METERS ** 2 - MIN_DISTANCE_METERS ** 2)
  );

export function approximateArea(exact: GeoPoint, secret: string): GeoPoint {
  const lat = roundTo5Decimals(exact.lat);
  const lng = roundTo5Decimals(exact.lng);
  const digest = createHmac("sha256", secret)
    .update(`approximate-area:v1:${lat.toFixed(5)},${lng.toFixed(5)}`)
    .digest();

  const bearing = 2 * Math.PI * (digest.readUIntBE(0, 6) / UINT48_RANGE);
  const distance = distanceInRing(digest.readUIntBE(6, 6) / UINT48_RANGE);

  return {
    lat: lat + (distance * Math.cos(bearing)) / METERS_PER_LAT_DEGREE,
    lng:
      lng +
      (distance * Math.sin(bearing)) / (METERS_PER_LAT_DEGREE * Math.cos((lat * Math.PI) / 180)),
  };
}
