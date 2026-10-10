import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/(landing)/blog/images/[file]/route';
import { REPO_POST_FILES } from '@/features/blog/__fixtures__/repo-posts';
import type { PostFile } from '@/features/blog/lib/post-file';

const disk = vi.hoisted(() => ({ postFiles: [] as PostFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withPostFiles } = await import('@/features/blog/__fixtures__/repo-posts');
  return withPostFiles(await importOriginal(), () => disk.postFiles);
});

const FIXTURE_PATH = path.join(__dirname, '../../features/blog/__fixtures__/published.json');
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
  vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jpegResponse());
});

afterEach(() => {
  disk.postFiles = [];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /blog/images/[file]', () => {
  it('serves a published photo from its Wikimedia source with a year-long immutable cache', async () => {
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

  it('serves a repo Markdown post’s photo the same way', async () => {
    disk.postFiles = [...REPO_POST_FILES];
    const response = await getImage('union-square-farmers-market.jpg');

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG_BYTES);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Union_Square_Greenmarket.jpg/1280px-Union_Square_Greenmarket.jpg',
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
