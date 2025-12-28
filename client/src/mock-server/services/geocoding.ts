/**
 * Geocoding Service
 *
 * Handles address to coordinate conversion
 * Can use Google Maps API or mock data
 */

import { Location, GeocodeResult } from '@/shared/types/map';

const USE_GOOGLE_MAPS = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Geocode an address to coordinates
 * Uses Google Maps API if available, otherwise returns mock data
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  // Use Google Maps API if configured
  if (USE_GOOGLE_MAPS) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          address: result.formatted_address,
          location: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
          placeId: result.place_id,
        };
      }
    } catch (error) {
      console.error('[Geocoding] Google Maps API error:', error);
      // Fall through to mock geocoding
    }
  }

  // Mock geocoding - return random location in NYC area
  return mockGeocode(address);
}

/**
 * Mock geocoding for testing without API key
 */
function mockGeocode(address: string): GeocodeResult {
  // Base location (NYC area)
  const baseLat = 40.7128;
  const baseLng = -74.006;

  // Add random offset to simulate different locations
  const offset = 0.02;
  const lat = baseLat + (Math.random() - 0.5) * offset;
  const lng = baseLng + (Math.random() - 0.5) * offset;

  return {
    address,
    location: { lat, lng },
    placeId: `mock_place_${Date.now()}`,
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
