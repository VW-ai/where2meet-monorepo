/**
 * Map and location-related type definitions
 */

export interface Location {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  address: string; // Formatted address
  location: Location;
  placeId?: string;
}

export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

/**
 * Where an event's map data comes from. Mainland China events use AMap (Gaode),
 * because Google Maps is blocked there. Fixed when the event is created.
 */
export type MapProvider = 'google' | 'amap';

export interface Route {
  participantId: string;
  distance: Distance;
  duration: Duration;
  polyline?: string; // Encoded polyline
}

export interface Distance {
  text: string; // e.g., "5.2 km"
  value: number; // In meters
}

export interface Duration {
  text: string; // e.g., "15 mins"
  value: number; // In seconds
}

export interface Circle {
  center: Location;
  radius: number; // In meters
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
