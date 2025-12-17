/**
 * Minimum Enclosing Circle (MEC) calculation module.
 *
 * Implements Welzl's algorithm for finding the smallest circle
 * that contains all given points. Adapted for geographic coordinates
 * using Haversine formula for distance calculations.
 * @module lib/mec
 */

/** Earth's radius in meters */
const EARTH_RADIUS_METERS = 6_371_000;

/** Degrees to radians conversion factor */
const DEG_TO_RAD = Math.PI / 180;

/** Radians to degrees conversion factor */
const RAD_TO_DEG = 180 / Math.PI;

/**
 * A geographic point with latitude and longitude.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Result of MEC calculation.
 */
export interface MECResult {
  center: GeoPoint;
  radiusMeters: number;
}

/**
 * Internal representation for Cartesian coordinates.
 * Used for Welzl's algorithm after projecting from geographic.
 */
interface CartesianPoint {
  x: number;
  y: number;
}

/**
 * Internal circle representation in Cartesian space.
 */
interface Circle {
  center: CartesianPoint;
  radius: number;
}

/**
 * Calculates the Haversine distance between two geographic points.
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in meters
 */
export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const lat1 = p1.lat * DEG_TO_RAD;
  const lat2 = p2.lat * DEG_TO_RAD;
  const deltaLat = (p2.lat - p1.lat) * DEG_TO_RAD;
  const deltaLng = (p2.lng - p1.lng) * DEG_TO_RAD;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates the geographic midpoint between two points.
 *
 * Uses spherical geometry for accurate results.
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Midpoint coordinates
 */
export function geographicMidpoint(p1: GeoPoint, p2: GeoPoint): GeoPoint {
  const lat1 = p1.lat * DEG_TO_RAD;
  const lng1 = p1.lng * DEG_TO_RAD;
  const lat2 = p2.lat * DEG_TO_RAD;
  const lng2 = p2.lng * DEG_TO_RAD;

  const Bx = Math.cos(lat2) * Math.cos(lng2 - lng1);
  const By = Math.cos(lat2) * Math.sin(lng2 - lng1);

  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)
  );
  const lng3 = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return {
    lat: lat3 * RAD_TO_DEG,
    lng: lng3 * RAD_TO_DEG,
  };
}

/**
 * Calculates the geographic centroid of multiple points.
 *
 * Converts to Cartesian, averages, then converts back.
 * @param points - Array of geographic points
 * @returns Centroid coordinates
 */
export function geographicCentroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) {
    throw new Error("Cannot calculate centroid of empty array");
  }

  // Use array destructuring to get first elements safely
  const [first, second] = points;

  if (points.length === 1 && first) {
    return { lat: first.lat, lng: first.lng };
  }

  if (points.length === 2 && first && second) {
    return geographicMidpoint(first, second);
  }

  // Convert to Cartesian and average
  let x = 0;
  let y = 0;
  let z = 0;

  for (const point of points) {
    const latRad = point.lat * DEG_TO_RAD;
    const lngRad = point.lng * DEG_TO_RAD;

    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const n = points.length;
  x /= n;
  y /= n;
  z /= n;

  const lng = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);

  return {
    lat: lat * RAD_TO_DEG,
    lng: lng * RAD_TO_DEG,
  };
}

/**
 * Projects geographic points to a local Cartesian plane.
 *
 * Uses equirectangular approximation centered on the centroid.
 * Accurate for city-scale distances (< 100km).
 * @param points - Geographic points to project
 * @param center - Center point for projection
 * @returns Projected Cartesian points in meters from center
 */
function projectToCartesian(points: GeoPoint[], center: GeoPoint): CartesianPoint[] {
  const centerLatRad = center.lat * DEG_TO_RAD;

  return points.map((p) => ({
    // x = longitude difference * Earth radius * cos(center latitude)
    x: (p.lng - center.lng) * DEG_TO_RAD * EARTH_RADIUS_METERS * Math.cos(centerLatRad),
    // y = latitude difference * Earth radius
    y: (p.lat - center.lat) * DEG_TO_RAD * EARTH_RADIUS_METERS,
  }));
}

/**
 * Projects a Cartesian point back to geographic coordinates.
 * @param point - Cartesian point in meters from center
 * @param center - Center point of projection
 * @returns Geographic coordinates
 */
function projectToGeographic(point: CartesianPoint, center: GeoPoint): GeoPoint {
  const centerLatRad = center.lat * DEG_TO_RAD;

  return {
    lat: center.lat + (point.y / EARTH_RADIUS_METERS) * RAD_TO_DEG,
    lng: center.lng + (point.x / (EARTH_RADIUS_METERS * Math.cos(centerLatRad))) * RAD_TO_DEG,
  };
}

/**
 * Calculates Euclidean distance between two Cartesian points.
 */
function cartesianDistance(p1: CartesianPoint, p2: CartesianPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Creates a circle from two points (diameter endpoints).
 */
function circleFromTwo(p1: CartesianPoint, p2: CartesianPoint): Circle {
  return {
    center: {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    },
    radius: cartesianDistance(p1, p2) / 2,
  };
}

/**
 * Creates a circumscribed circle from three points.
 *
 * Returns null if points are collinear.
 */
function circleFromThree(
  p1: CartesianPoint,
  p2: CartesianPoint,
  p3: CartesianPoint
): Circle | null {
  const ax = p1.x;
  const ay = p1.y;
  const bx = p2.x;
  const by = p2.y;
  const cx = p3.x;
  const cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  // Points are collinear (or very close to it)
  if (Math.abs(d) < 1e-10) {
    return null;
  }

  const aSq = ax * ax + ay * ay;
  const bSq = bx * bx + by * by;
  const cSq = cx * cx + cy * cy;

  const ux = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
  const uy = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  const radius = cartesianDistance(center, p1);

  return { center, radius };
}

/**
 * Checks if a point is inside or on the boundary of a circle.
 *
 * Uses a small epsilon for floating-point tolerance.
 */
function isInsideCircle(point: CartesianPoint, circle: Circle): boolean {
  const dist = cartesianDistance(point, circle.center);
  // Small tolerance for floating-point errors (1mm)
  return dist <= circle.radius + 0.001;
}

/**
 * Creates the minimum enclosing circle for a set of boundary points.
 *
 * Handles 0, 1, 2, or 3 boundary points.
 */
function makeCircleFromBoundary(boundary: CartesianPoint[]): Circle {
  const [b0, b1, b2] = boundary;

  if (!b0) {
    return { center: { x: 0, y: 0 }, radius: 0 };
  }

  if (!b1) {
    return { center: { x: b0.x, y: b0.y }, radius: 0 };
  }

  if (!b2) {
    return circleFromTwo(b0, b1);
  }

  // Three points - try circumscribed circle first
  const circumscribed = circleFromThree(b0, b1, b2);
  if (circumscribed) {
    return circumscribed;
  }

  // Collinear points - find the two farthest apart
  const d01 = cartesianDistance(b0, b1);
  const d02 = cartesianDistance(b0, b2);
  const d12 = cartesianDistance(b1, b2);

  if (d01 >= d02 && d01 >= d12) {
    return circleFromTwo(b0, b1);
  } else if (d02 >= d01 && d02 >= d12) {
    return circleFromTwo(b0, b2);
  } else {
    return circleFromTwo(b1, b2);
  }
}

/**
 * Welzl's algorithm for minimum enclosing circle.
 *
 * Recursively finds the smallest circle containing all points.
 * Expected O(n) time complexity with randomization.
 * @param points - Points that must be inside the circle
 * @param boundary - Points that must be on the circle boundary
 * @returns Minimum enclosing circle
 */
function welzl(points: CartesianPoint[], boundary: CartesianPoint[]): Circle {
  // Base case: no more points to process or boundary is full (3 points)
  if (points.length === 0 || boundary.length === 3) {
    return makeCircleFromBoundary(boundary);
  }

  // Pick a random point (shuffle for randomization)
  const idx = Math.floor(Math.random() * points.length);
  const point = points[idx];

  // Safety check (should never happen given length check above)
  if (!point) {
    return makeCircleFromBoundary(boundary);
  }

  // Remove the point from the array
  const remaining = [...points.slice(0, idx), ...points.slice(idx + 1)];

  // Recursively find MEC without this point
  const circle = welzl(remaining, boundary);

  // If the point is inside the circle, we're done
  if (isInsideCircle(point, circle)) {
    return circle;
  }

  // Otherwise, the point must be on the boundary
  return welzl(remaining, [...boundary, point]);
}

/**
 * Calculates the Minimum Enclosing Circle for a set of geographic points.
 *
 * Uses Welzl's algorithm on a local Cartesian projection.
 * Accurate for city-scale distances (participants within ~100km).
 * @param points - Array of geographic points (participants)
 * @returns MEC result with center and radius, or null if no points
 * @example
 * ```typescript
 * const participants = [
 *   { lat: 40.7128, lng: -74.0060 },  // NYC
 *   { lat: 40.7580, lng: -73.9855 },  // Times Square
 *   { lat: 40.6892, lng: -74.0445 },  // Statue of Liberty
 * ];
 *
 * const mec = calculateMEC(participants);
 * // { center: { lat: 40.72, lng: -74.01 }, radiusMeters: 5200 }
 * ```
 */
export function calculateMEC(points: GeoPoint[]): MECResult | null {
  // Use array destructuring to avoid non-null assertions
  const [first, second] = points;

  // Edge case: no points
  if (!first) {
    return null;
  }

  // Edge case: single point
  if (!second) {
    return {
      center: { lat: first.lat, lng: first.lng },
      radiusMeters: 0,
    };
  }

  // Edge case: two points
  if (points.length === 2) {
    const center = geographicMidpoint(first, second);
    const radiusMeters = haversineDistance(first, second) / 2;
    return { center, radiusMeters };
  }

  // For 3+ points, use Welzl's algorithm on Cartesian projection
  const centroid = geographicCentroid(points);
  const cartesianPoints = projectToCartesian(points, centroid);

  // Shuffle points for randomization (improves average-case performance)
  const shuffled = [...cartesianPoints].sort(() => Math.random() - 0.5);

  const circle = welzl(shuffled, []);

  // Convert back to geographic coordinates
  const center = projectToGeographic(circle.center, centroid);

  return {
    center,
    radiusMeters: circle.radius,
  };
}
