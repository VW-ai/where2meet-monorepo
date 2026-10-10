import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, generateStaticParams } from '@/app/(landing)/blog/images/[file]/route';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jpegResponse());

function jpegResponse() {
  return new Response(JPEG_BYTES, { headers: { 'Content-Type': 'image/jpeg' } });
}

function getImage(file: string) {
  return GET(new Request(`http://localhost/blog/images/${file}`), {
    params: Promise.resolve({ file }),
  });
}

beforeEach(() => {
  disk.files = [...FIXTURE_FILES];
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jpegResponse());
});

afterEach(() => {
  disk.files = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GET /blog/images/[file]', () => {
  it('prerenders every post and place photo, and only those', async () => {
    expect((await generateStaticParams()).map(({ file }) => file).sort()).toEqual([
      'bryant-park-carousel-midtown.jpg',
      'bryant-park-from-one-vanderbilt.jpg',
      'bryant-park-lawn-midtown.jpg',
      'grand-central-concourse-windows.jpg',
      'grand-central-main-concourse-new-york.jpg',
      'herald-square-plaza-new-york.jpg',
      'hot-dog-stand-times-square.jpg',
      'midtown-manhattan-skyline-new-york.jpg',
      'midtown-view-from-empire-state-building.jpg',
      'new-york-public-library-lion-midtown.jpg',
      'rockefeller-center-concourse.jpg',
      'rockefeller-center-lights-at-sunset.jpg',
      'seventh-avenue-times-square-north.jpg',
      'times-square-crowds-new-york.jpg',
    ]);
  });

  it('serves a place photo from its Wikimedia source with a year-long immutable cache', async () => {
    const response = await getImage('bryant-park-lawn-midtown.jpg');

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toEqual({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'image/jpeg',
    });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
    expect(fetchMock.mock.calls).toEqual([
      [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Bryant_Park_jeh.JPG/1280px-Bryant_Park_jeh.JPG',
        {
          headers: {
            'User-Agent':
              'Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)',
          },
          next: { revalidate: false },
          signal: expect.any(AbortSignal),
        },
      ],
    ]);
  });

  it('serves a post’s photo the same way', async () => {
    const response = await getImage('bryant-park-carousel-midtown.jpg');

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Carrousel_de_Bryant_Park_%C3%A0_Manhattan.jpg/1280px-Carrousel_de_Bryant_Park_%C3%A0_Manhattan.jpg',
    ]);
  });

  it.each([
    'unpublished-photo.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/5/58/Bryant_Park_jeh.JPG',
    '..%2F..%2Fpackage.json',
    'cover.png',
    'Bryant_Park_jeh.JPG',
  ])('answers 404 for %s without fetching anything', async (file) => {
    const response = await getImage(file);
    expect([response.status, await response.text()]).toEqual([404, 'Not found']);
    expect(fetchMock.mock.calls).toEqual([]);
  });

  it('refuses to serve anything but a JPEG from our domain', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response('<svg onload="alert(1)"/>', { headers: { 'Content-Type': 'image/svg+xml' } })
    );
    const response = await getImage('bryant-park-lawn-midtown.jpg');
    expect([response.status, await response.text()]).toEqual([502, 'Bad gateway']);
  });

  it('retries a rate-limited fetch twice, then fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock.mockImplementation(async () => new Response('slow down', { status: 429 }));
    const failure = expect(getImage('bryant-park-lawn-midtown.jpg')).rejects.toThrow(
      'Wikimedia answered 429 for bryant-park-lawn-midtown.jpg'
    );
    for (const waited of [1, 2]) {
      await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(waited));
      await vi.advanceTimersByTimeAsync(waited * 2000);
    }
    await failure;
    expect(fetchMock.mock.calls).toHaveLength(3);
  });
});
