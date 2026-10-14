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

  it('retries a fetch that times out, drops its connection or gets a 503, then serves the photo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const timedOut = new TypeError('fetch failed', {
      cause: Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    });
    fetchMock
      .mockRejectedValueOnce(timedOut)
      .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }));
    const failure = expect(getImage('bryant-park-lawn-midtown.jpg')).rejects.toThrow(
      'Wikimedia answered 503 for bryant-park-lawn-midtown.jpg'
    );
    for (const waited of [1, 2]) {
      await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(waited));
      await vi.advanceTimersByTimeAsync(waited * 2000);
    }
    await failure;

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(timedOut).mockResolvedValueOnce(jpegResponse());
    const served = getImage('bryant-park-lawn-midtown.jpg');
    await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(2000);
    const response = await served;
    expect([response.status, fetchMock.mock.calls.length]).toEqual([200, 2]);
  });

  it('serves the photo after Wikimedia answers 503 and then 500', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('broken', { status: 500 }))
      .mockResolvedValueOnce(jpegResponse());
    const served = getImage('bryant-park-lawn-midtown.jpg');
    for (const waited of [1, 2]) {
      await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(waited));
      await vi.advanceTimersByTimeAsync(waited * 2000);
    }
    const response = await served;
    expect([response.status, fetchMock.mock.calls.length]).toEqual([200, 3]);
  });

  it('says why Wikimedia could not be reached after the last try', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      })
    );
    const failure = expect(getImage('bryant-park-lawn-midtown.jpg')).rejects.toThrow(
      'Wikimedia could not be reached (ECONNRESET) for bryant-park-lawn-midtown.jpg'
    );
    for (const waited of [1, 2]) {
      await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(waited));
      await vi.advanceTimersByTimeAsync(waited * 2000);
    }
    await failure;
    expect(fetchMock.mock.calls).toHaveLength(3);
  });

  it('does not retry an answer that will not change, such as a 404', async () => {
    fetchMock.mockImplementation(async () => new Response('gone', { status: 404 }));
    await expect(getImage('bryant-park-lawn-midtown.jpg')).rejects.toThrow(
      'Wikimedia answered 404 for bryant-park-lawn-midtown.jpg'
    );
    expect(fetchMock.mock.calls).toHaveLength(1);
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
