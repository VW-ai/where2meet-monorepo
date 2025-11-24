/**
 * Mock Geocoding API
 * Maps addresses to coordinates
 * Day 1: Basic implementation, will be enhanced in Day 2
 */

import type { Location } from '@/types';

// Mock coordinates for NYC addresses
// Maps place_id to lat/lng
const MOCK_COORDINATES: Record<string, Location> = {
  // Manhattan
  place_001: { lat: 40.748817, lng: -73.985428 }, // Empire State Building
  place_002: { lat: 40.758896, lng: -73.98513 }, // Times Square
  place_003: { lat: 40.752726, lng: -73.977229 }, // Grand Central
  place_004: { lat: 40.750504, lng: -73.993439 }, // Madison Square Garden
  place_005: { lat: 40.782865, lng: -73.958969 }, // Guggenheim
  place_006: { lat: 40.707091, lng: -74.010849 }, // Wall Street
  place_007: { lat: 40.762352, lng: -73.973714 }, // Trump Tower
  place_008: { lat: 40.758742, lng: -73.978674 }, // Rockefeller Center
  place_009: { lat: 40.768193, lng: -73.981954 }, // Columbus Circle
  place_010: { lat: 40.712743, lng: -74.013379 }, // One World Trade

  // Brooklyn
  place_011: { lat: 40.697488, lng: -73.996864 }, // Brooklyn Bridge Park
  place_012: { lat: 40.671296, lng: -73.963743 }, // Brooklyn Museum
  place_013: { lat: 40.682661, lng: -73.975363 }, // Barclays Center
  place_014: { lat: 40.690476, lng: -73.986756 },
  place_015: { lat: 40.655174, lng: -73.950932 },
  place_016: { lat: 40.71677, lng: -73.958097 },
  place_017: { lat: 40.682389, lng: -73.975594 },
  place_018: { lat: 40.691796, lng: -73.985428 },
  place_019: { lat: 40.71989, lng: -73.959702 },
  place_020: { lat: 40.672837, lng: -73.982992 },

  // Queens
  place_021: { lat: 40.757088, lng: -73.845818 }, // Citi Field
  place_022: { lat: 40.774155, lng: -73.88007 },
  place_023: { lat: 40.756317, lng: -73.929787 },
  place_024: { lat: 40.743883, lng: -73.938232 },
  place_025: { lat: 40.737934, lng: -73.888075 },
  place_026: { lat: 40.733863, lng: -73.877419 },
  place_027: { lat: 40.775642, lng: -73.907528 },
  place_028: { lat: 40.762691, lng: -73.822891 },
  place_029: { lat: 40.714863, lng: -73.843222 },
  place_030: { lat: 40.747101, lng: -73.95481 },

  // Bronx
  place_031: { lat: 40.829643, lng: -73.926175 }, // Yankee Stadium
  place_032: { lat: 40.850763, lng: -73.877214 }, // Bronx Zoo
  place_033: { lat: 40.855617, lng: -73.904063 },
  place_034: { lat: 40.821868, lng: -73.926909 },
  place_035: { lat: 40.849972, lng: -73.891758 },
  place_036: { lat: 40.855617, lng: -73.904063 },
  place_037: { lat: 40.877216, lng: -73.881954 },
  place_038: { lat: 40.891821, lng: -73.85418 },
  place_039: { lat: 40.895123, lng: -73.833851 },
  place_040: { lat: 40.854122, lng: -73.888536 },

  // Staten Island
  place_041: { lat: 40.643772, lng: -74.07535 },
  place_042: { lat: 40.643772, lng: -74.075905 },
  place_043: { lat: 40.620903, lng: -74.139557 },
  place_044: { lat: 40.618381, lng: -74.088364 },
  place_045: { lat: 40.626743, lng: -74.113007 },

  // More Manhattan
  place_046: { lat: 40.719575, lng: -74.002374 },
  place_047: { lat: 40.781513, lng: -73.9739 },
  place_048: { lat: 40.706877, lng: -74.009056 },
  place_049: { lat: 40.751652, lng: -73.975311 }, // Chrysler Building
  place_050: { lat: 40.771872, lng: -73.984016 },
  place_051: { lat: 40.779437, lng: -73.963244 }, // Met Museum
  place_052: { lat: 40.741895, lng: -73.999685 },
};

/**
 * Mock geocode function that returns coordinates for a place_id
 * @param placeId Google Places API place ID
 * @returns Location with lat/lng or null if not found
 */
export async function mockGeocode(placeId: string): Promise<Location | null> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const location = MOCK_COORDINATES[placeId];

  if (!location) {
    // Return default NYC coordinates if place_id not found
    console.warn(`Place ID ${placeId} not found in mock data, using default NYC coordinates`);
    return {
      lat: 40.7128, // NYC center
      lng: -74.006,
    };
  }

  return location;
}

/**
 * Get coordinates for an address (reverse lookup by place_id)
 * @param address Full address string
 * @param placeId Place ID from autocomplete
 * @returns Location coordinates
 */
export async function geocodeAddress(address: string, placeId: string): Promise<Location> {
  const location = await mockGeocode(placeId);

  if (!location) {
    throw new Error(`Failed to geocode address: ${address}`);
  }

  return location;
}
