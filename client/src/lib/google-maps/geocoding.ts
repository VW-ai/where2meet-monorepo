/**
 * Google Geocoding Service
 *
 * Converts addresses to coordinates and vice versa
 */

import { loadGoogleMaps } from './loader';
import { Location } from '@/types';

export interface GeocodeResult {
  address: string;
  location: Location;
  placeId: string;
}

/**
 * Geocode an address to get coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const result = results[0];
          resolve({
            address: result.formatted_address,
            location: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            },
            placeId: result.place_id,
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to get an address
 */
export async function reverseGeocode(location: Location): Promise<GeocodeResult> {
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode(
        { location: { lat: location.lat, lng: location.lng } },
        (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const result = results[0];
            resolve({
              address: result.formatted_address,
              location: {
                lat: result.geometry.location.lat(),
                lng: result.geometry.location.lng(),
              },
              placeId: result.place_id,
            });
          } else {
            reject(new Error(`Reverse geocoding failed: ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('[Reverse Geocoding] Error:', error);
    throw error;
  }
}
