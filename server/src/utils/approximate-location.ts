/**
 * Approximate locations for participants who hide their exact address.
 *
 * Others see a point 800 to 1,600 m (0.5 to 1 mile) from the geocoded one, as the
 * add-participant form promises. Direction and distance come from `crypto.randomInt`
 * alone, so the area is independent of participant details.
 * @module utils/approximate-location
 */

import { randomInt } from "crypto";
import type { GeoPoint } from "./mec.js";

const MIN_DISTANCE_METERS = 800;
const MAX_DISTANCE_METERS = 1_600;

const METERS_PER_LAT_DEGREE = 111_320;

const DRAW_STEPS = 1_000_000;

function randomFraction(): number {
  return randomInt(DRAW_STEPS) / DRAW_STEPS;
}

/**
 * Picks a random point in the ring around a location.
 *
 * The square root makes every part of the ring equally likely, instead of
 * crowding points toward the inner edge.
 * @param exact - Geocoded location
 * @returns A point 800 to 1,600 m away in a random direction
 */
export function approximateLocation(exact: GeoPoint): GeoPoint {
  const bearing = randomFraction() * 2 * Math.PI;
  const distance = Math.sqrt(
    MIN_DISTANCE_METERS ** 2 +
      randomFraction() * (MAX_DISTANCE_METERS ** 2 - MIN_DISTANCE_METERS ** 2)
  );
  const metersPerLngDegree = METERS_PER_LAT_DEGREE * Math.cos((exact.lat * Math.PI) / 180);

  return {
    lat: exact.lat + (distance * Math.cos(bearing)) / METERS_PER_LAT_DEGREE,
    lng: exact.lng + (distance * Math.sin(bearing)) / metersPerLngDegree,
  };
}
