import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VenueSearchRequest, VenueSearchResponse } from '@/shared/types/api';

const BACKEND_URL = 'https://api.where2meet.test';

const REQUEST: VenueSearchRequest = {
  center: { lat: 40.7484, lng: -73.9857 },
  searchRadius: 1500,
  query: 'ramen',
  eventId: 'evt_1760000000000_abcdefghijklmnop',
};

const RESPONSE: VenueSearchResponse = {
  venues: [],
  totalResults: 0,
  searchCenter: { lat: 40.7484, lng: -73.9857 },
};

async function search(token?: string) {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', BACKEND_URL);
  vi.resetModules();
  const { venuesApi } = await import('@/lib/api/venues');
  const fetchStub = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', fetchStub);

  const result = await venuesApi.search(REQUEST, token);

  const [url, init] = fetchStub.mock.calls[0] ?? [];
  return {
    result,
    calls: fetchStub.mock.calls.length,
    url,
    method: init?.method,
    body: JSON.parse(String(init?.body)),
    headers: init?.headers,
  };
}

describe('venuesApi.search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the meeting and the token when given one', async () => {
    expect(await search('pt_token')).toStrictEqual({
      result: RESPONSE,
      calls: 1,
      url: 'https://api.where2meet.test/api/venues/search',
      method: 'POST',
      body: {
        center: { lat: 40.7484, lng: -73.9857 },
        searchRadius: 1500,
        query: 'ramen',
        eventId: 'evt_1760000000000_abcdefghijklmnop',
      },
      headers: { Authorization: 'Bearer pt_token', 'Content-Type': 'application/json' },
    });
  });

  it('sends no Authorization header without a token', async () => {
    expect(await search()).toStrictEqual({
      result: RESPONSE,
      calls: 1,
      url: 'https://api.where2meet.test/api/venues/search',
      method: 'POST',
      body: {
        center: { lat: 40.7484, lng: -73.9857 },
        searchRadius: 1500,
        query: 'ramen',
        eventId: 'evt_1760000000000_abcdefghijklmnop',
      },
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
