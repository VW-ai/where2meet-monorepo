import type { Location } from '@/shared/types/map';

/** The reader's approximate city, from Vercel's IP geolocation headers. */
export interface VisitorGeo extends Location {
  city: string;
  region: string | null;
  country: string | null;
  source: 'ip' | 'default';
}

export const DEFAULT_GEO: VisitorGeo = {
  city: 'San Francisco',
  region: 'CA',
  country: 'US',
  lat: 37.7749,
  lng: -122.4194,
  source: 'default',
};

export function geoFromHeaders(headers: Headers): VisitorGeo {
  const city = decodeCity(headers.get('x-vercel-ip-city'));
  const lat = parseCoordinate(headers.get('x-vercel-ip-latitude'), 90);
  const lng = parseCoordinate(headers.get('x-vercel-ip-longitude'), 180);
  if (!city || lat === null || lng === null) return DEFAULT_GEO;

  return {
    city,
    region: headers.get('x-vercel-ip-country-region') || null,
    country: headers.get('x-vercel-ip-country') || null,
    lat,
    lng,
    source: 'ip',
  };
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
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : null;
}
