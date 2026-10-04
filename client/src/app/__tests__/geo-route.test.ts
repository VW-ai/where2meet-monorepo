import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/geo/route';

function requestGeo(headers: Record<string, string>) {
  return GET(new Request('http://localhost/api/geo', { headers }));
}

const SAN_FRANCISCO = { city: 'San Francisco', lat: 37.7749, lng: -122.4194 };

describe('GET /api/geo', () => {
  it("returns the reader's city from Vercel's headers, decoded", async () => {
    const response = requestGeo({
      'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
      'x-vercel-ip-latitude': '-23.5475',
      'x-vercel-ip-longitude': '-46.6361',
    });

    expect(await response.json()).toEqual({ city: 'São Paulo', lat: -23.5475, lng: -46.6361 });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('falls back to San Francisco without geolocation headers', async () => {
    const response = requestGeo({});

    expect(await response.json()).toEqual(SAN_FRANCISCO);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([
    ['letters', 'abc', '-87.6'],
    ['an empty value', '41.9', ''],
    ['an out-of-range latitude', '123', '-87.6'],
  ])('falls back to San Francisco when a coordinate is %s', async (_, latitude, longitude) => {
    const response = requestGeo({
      'x-vercel-ip-city': 'Chicago',
      'x-vercel-ip-latitude': latitude,
      'x-vercel-ip-longitude': longitude,
    });

    expect(await response.json()).toEqual(SAN_FRANCISCO);
  });

  it('falls back to San Francisco when the city is not valid percent-encoding', async () => {
    const response = requestGeo({
      'x-vercel-ip-city': '%E0%A4%A',
      'x-vercel-ip-latitude': '41.9',
      'x-vercel-ip-longitude': '-87.6',
    });

    expect(await response.json()).toEqual(SAN_FRANCISCO);
  });
});
