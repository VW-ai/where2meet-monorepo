import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/meet/[id]/invite.png/route';
import type { Event, Venue } from '@/entities';
import { eventClient, venueClient } from '@/features/meeting/api';
import { APIError } from '@/lib/api/client';

vi.mock('@/features/meeting/api', () => ({
  eventClient: { get: vi.fn() },
  venueClient: { get: vi.fn() },
}));

const GREY_PIXEL_JPEG = Buffer.from(
  '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AA//Z',
  'base64'
);

const coffee: Venue = {
  id: 'ChIJ787',
  name: '787 Coffee',
  address: '159 2nd Ave, New York, NY 10003',
  location: { lat: 40.7297, lng: -73.9868 },
  types: ['cafe', 'food'],
  rating: null,
  userRatingsTotal: null,
  priceLevel: null,
  openNow: null,
  photoUrl: 'https://photos.example/787.jpg',
};

const published: Event = {
  id: 'evt_1_abc',
  title: 'Coffee test',
  meetingTime: '2026-10-17T15:00:00Z',
  createdAt: '2026-10-10T09:00:00Z',
  updatedAt: '2026-10-10T09:00:00Z',
  participants: [
    {
      id: 'p1',
      name: 'Victor',
      address: null,
      location: null,
      color: 'bg-coral-500',
      fuzzyLocation: false,
      isOrganizer: true,
    },
  ],
  mec: { center: { lat: 40.73, lng: -73.99 }, radiusMeters: 1200 },
  publishedVenueId: coffee.id,
  publishedAt: '2026-10-14T12:00:00Z',
  settings: { allowParticipantsAfterPublish: true },
};

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(GREY_PIXEL_JPEG));

function invite(id = published.id) {
  return GET(new Request(`http://localhost/meet/${id}/invite.png`), {
    params: Promise.resolve({ id }),
  });
}

async function pngSize(response: Response) {
  expect(response.headers.get('content-type')).toBe('image/png');
  const png = Buffer.from(await response.arrayBuffer());
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  vi.mocked(eventClient.get).mockResolvedValue(published);
  vi.mocked(venueClient.get).mockResolvedValue(coffee);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /meet/[id]/invite.png', () => {
  it('draws a 1200x630 PNG from the venue photo, cached a minute at the edge', async () => {
    const response = await invite();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=600'
    );
    expect(await pngSize(response)).toEqual([1200, 630]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([coffee.photoUrl]);
  });

  it('still draws the card when the photo or the venue cannot be loaded', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));
    expect(await pngSize(await invite())).toEqual([1200, 630]);

    vi.mocked(venueClient.get).mockRejectedValueOnce(new APIError(500, 'INTERNAL', 'down'));
    expect(await pngSize(await invite())).toEqual([1200, 630]);
  });

  it('answers 404 for a draft event and for an unknown one', async () => {
    vi.mocked(eventClient.get).mockResolvedValueOnce({
      ...published,
      publishedAt: null,
      publishedVenueId: null,
    });
    expect((await invite()).status).toBe(404);

    vi.mocked(eventClient.get).mockRejectedValueOnce(new APIError(404, 'NOT_FOUND', 'no event'));
    expect((await invite('evt_0_nope')).status).toBe(404);
  });
});
