/**
 * Location Utilities
 *
 * Utilities for working with geographic coordinates, including fuzzy location logic
 */

import { Location } from '@/shared/types/map';

/**
 * Apply fuzzy offset to coordinates to hide exact location
 *
 * Adds random offset between ±0.005 to ±0.01 degrees (~0.5 to 1 mile)
 * This protects user privacy by showing approximate area instead of exact address
 *
 * @param location - Original coordinates
 * @returns Location with fuzzy offset applied
 */
export function applyFuzzyOffset(location: Location): Location {
  // Random offset between 0.005 and 0.01 degrees
  const minOffset = 0.005;
  const maxOffset = 0.01;

  // Random offset in range, with random sign (+ or -)
  const latOffset =
    (Math.random() * (maxOffset - minOffset) + minOffset) * (Math.random() < 0.5 ? 1 : -1);
  const lngOffset =
    (Math.random() * (maxOffset - minOffset) + minOffset) * (Math.random() < 0.5 ? 1 : -1);

  return {
    lat: location.lat + latOffset,
    lng: location.lng + lngOffset,
  };
}

/**
 * Format address for fuzzy location display
 * Shows "Near {street name}, {city}" instead of exact address
 *
 * @param fullAddress - Complete address string
 * @returns Formatted fuzzy address
 */
export function formatFuzzyAddress(fullAddress: string): string {
  // Extract street name and city from full address
  // Format: "123 Main St, New York, NY 10001" -> "Near Main St, New York"
  const parts = fullAddress.split(',').map((p) => p.trim());

  if (parts.length < 2) {
    return `Near ${fullAddress}`;
  }

  // Get street name (remove number from first part)
  const streetPart = parts[0].replace(/^\d+\s*/, '').trim();
  const city = parts[1];

  return `Near ${streetPart}, ${city}`;
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 *
 * @param point1 - First coordinate
 * @param point2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance for display
 *
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "1.2 mi" or "500 ft")
 */
export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;

  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }

  return `${miles.toFixed(1)} mi`;
}
