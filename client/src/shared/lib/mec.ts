/**
 * Minimum Enclosing Circle (MEC) Algorithm
 *
 * Implements Welzl's algorithm to find the smallest circle that encloses all given points.
 * This is used to calculate the optimal meeting area for all participants.
 *
 * Time Complexity: O(n) expected
 */

import type { Location } from '@/shared/types/map';

export interface Circle {
  center: Location;
  radius: number; // in meters
}

/**
 * Calculate the distance between two points in meters using Haversine formula
 */
function haversineDistance(p1: Location, p2: Location): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the midpoint between two locations
 */
function midpoint(p1: Location, p2: Location): Location {
  return {
    lat: (p1.lat + p2.lat) / 2,
    lng: (p1.lng + p2.lng) / 2,
  };
}

/**
 * Check if a point is inside a circle (with small epsilon for floating point errors)
 */
function isInsideCircle(point: Location, circle: Circle): boolean {
  const distance = haversineDistance(point, circle.center);
  return distance <= circle.radius + 0.01; // 1cm epsilon
}

/**
 * Create a circle from two points (diameter)
 */
function circleFromTwoPoints(p1: Location, p2: Location): Circle {
  const center = midpoint(p1, p2);
  const radius = haversineDistance(p1, p2) / 2;
  return { center, radius };
}

/**
 * Create a circle from three points (circumcircle)
 * Uses the formula for circumcenter of a triangle
 */
function circleFromThreePoints(p1: Location, p2: Location, p3: Location): Circle {
  // Convert to Cartesian coordinates for calculation (approximate, good for small areas)
  const ax = p1.lng;
  const ay = p1.lat;
  const bx = p2.lng;
  const by = p2.lat;
  const cx = p3.lng;
  const cy = p3.lat;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  // Check for collinear points
  if (Math.abs(d) < 1e-10) {
    // Points are collinear, find the two farthest points
    const d12 = haversineDistance(p1, p2);
    const d23 = haversineDistance(p2, p3);
    const d13 = haversineDistance(p1, p3);

    if (d12 >= d23 && d12 >= d13) {
      return circleFromTwoPoints(p1, p2);
    } else if (d23 >= d12 && d23 >= d13) {
      return circleFromTwoPoints(p2, p3);
    } else {
      return circleFromTwoPoints(p1, p3);
    }
  }

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;

  const center: Location = { lat: uy, lng: ux };
  const radius = haversineDistance(center, p1);

  return { center, radius };
}

/**
 * Create the minimum circle from at most 3 boundary points
 */
function minCircleFromBoundary(boundary: Location[]): Circle {
  if (boundary.length === 0) {
    return { center: { lat: 0, lng: 0 }, radius: 0 };
  }
  if (boundary.length === 1) {
    return { center: boundary[0], radius: 0 };
  }
  if (boundary.length === 2) {
    return circleFromTwoPoints(boundary[0], boundary[1]);
  }
  // boundary.length === 3
  return circleFromThreePoints(boundary[0], boundary[1], boundary[2]);
}

/**
 * Welzl's algorithm for finding the minimum enclosing circle
 * Recursive implementation with randomization for expected O(n) time
 */
function welzl(points: Location[], boundary: Location[], n: number): Circle {
  // Base case: no points left or 3 boundary points
  if (n === 0 || boundary.length === 3) {
    return minCircleFromBoundary(boundary);
  }

  // Pick a random point (for expected O(n) complexity)
  const idx = Math.floor(Math.random() * n);
  const p = points[idx];

  // Swap with last point
  [points[idx], points[n - 1]] = [points[n - 1], points[idx]];

  // Recursively find MEC without this point
  const circle = welzl(points, boundary, n - 1);

  // If point is inside the circle, we're done
  if (isInsideCircle(p, circle)) {
    return circle;
  }

  // Point is on the boundary of the MEC
  return welzl(points, [...boundary, p], n - 1);
}

/**
 * Calculate the Minimum Enclosing Circle for a set of locations
 *
 * @param locations Array of participant locations
 * @returns Circle object with center and radius (in meters)
 */
export function calculateMEC(locations: Location[]): Circle {
  // Filter out invalid locations
  const validLocations = locations.filter(
    (loc) => loc.lat !== null && loc.lng !== null && !isNaN(loc.lat) && !isNaN(loc.lng)
  );

  if (validLocations.length === 0) {
    return { center: { lat: 0, lng: 0 }, radius: 0 };
  }

  if (validLocations.length === 1) {
    return { center: validLocations[0], radius: 0 };
  }

  if (validLocations.length === 2) {
    return circleFromTwoPoints(validLocations[0], validLocations[1]);
  }

  // Make a copy to avoid modifying the original array
  const points = [...validLocations];

  // Shuffle points for better expected time complexity
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  return welzl(points, [], points.length);
}

/**
 * Calculate a suggested search radius based on the MEC
 * Returns a radius that's slightly larger than the MEC to include nearby venues
 *
 * @param mec The minimum enclosing circle
 * @param multiplier How much larger than the MEC (default 1.5x)
 * @param minRadius Minimum search radius in meters (default 1000m)
 * @param maxRadius Maximum search radius in meters (default 10000m)
 */
export function calculateSearchRadius(
  mec: Circle,
  multiplier: number = 1.5,
  minRadius: number = 1000,
  maxRadius: number = 10000
): number {
  const suggestedRadius = mec.radius * multiplier;
  return Math.max(minRadius, Math.min(maxRadius, suggestedRadius));
}

/**
 * Get the center point for venue search based on participants
 *
 * @param locations Array of participant locations
 * @returns The center of the MEC
 */
export function getSearchCenter(locations: Location[]): Location {
  const mec = calculateMEC(locations);
  return mec.center;
}
