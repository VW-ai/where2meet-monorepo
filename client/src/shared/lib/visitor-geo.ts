import type { Location } from '@/shared/types/map';

/** The reader's approximate city, from Vercel's IP geolocation headers. */
export interface VisitorGeo extends Location {
  city: string;
}

export const DEFAULT_GEO: VisitorGeo = { city: 'San Francisco', lat: 37.7749, lng: -122.4194 };

export function geoFromHeaders(headers: Headers): VisitorGeo {
  const city = decodeCity(headers.get('x-vercel-ip-city'));
  const lat = parseCoordinate(headers.get('x-vercel-ip-latitude'), 90);
  const lng = parseCoordinate(headers.get('x-vercel-ip-longitude'), 180);
  return city && lat !== null && lng !== null ? { city, lat, lng } : DEFAULT_GEO;
}

/** Reads a GET /api/geo response body. Throws on anything else. */
export function parseVisitorGeo(body: unknown): VisitorGeo {
  if (
    typeof body === 'object' &&
    body !== null &&
    'city' in body &&
    'lat' in body &&
    'lng' in body &&
    typeof body.city === 'string' &&
    body.city !== '' &&
    isCoordinate(body.lat, 90) &&
    isCoordinate(body.lng, 180)
  ) {
    return { city: body.city, lat: body.lat, lng: body.lng };
  }
  throw new Error(`Unexpected /api/geo response: ${JSON.stringify(body)}`);
}

/** Vercel percent-encodes non-ASCII city names, e.g. `S%C3%A3o%20Paulo`. */
function decodeCity(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}

function parseCoordinate(value: string | null, limit: number): number | null {
  if (!value?.trim()) return null;
  const coordinate = Number(value);
  return isCoordinate(coordinate, limit) ? coordinate : null;
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}
