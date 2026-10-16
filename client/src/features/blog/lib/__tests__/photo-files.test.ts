import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { fixtureContent } from '@/features/blog/__fixtures__/content-files';
import { BlogPageView } from '@/features/blog/ui/blog-page';
import { catalogImages, listPages, type Catalog } from '../catalog';
import { parseCatalog } from '../parse';
import { readPhotoFile, writePhotoFiles } from '../photo-files';
import { loadCatalog } from '../source';

const ORIGIN = 'https://www.where2meet.org';
const SKYLINE = 'midtown-manhattan-skyline-new-york.jpg';
const SKYLINE_SOURCE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Midtown_Manhattan_2019.jpg/1280px-Midtown_Manhattan_2019.jpg';

const FIXTURE_PHOTOS = [
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
];

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function jpegResponse() {
  return new Response(JPEG_BYTES, { headers: { 'Content-Type': 'image/jpeg' } });
}

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jpegResponse());

const fixtureCatalog = parseCatalog(fixtureContent()).catalog;

function skylineOnly(sourceUrl = SKYLINE_SOURCE): Catalog {
  const city = fixtureCatalog.cities.get('new-york');
  if (!city?.image) throw new Error('The fixtures have no New York photo');
  const image = { ...city.image, sourceUrl };
  return {
    ...fixtureCatalog,
    posts: [],
    cities: new Map([[city.slug, { ...city, image, towns: new Map() }]]),
  };
}

let root: string;

function photosOnDisk() {
  return readdir(path.join(root, 'public/blog/images')).then((names) => names.sort());
}

async function advanceThroughRetries() {
  for (const waited of [1, 2]) {
    await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(waited));
    await vi.advanceTimersByTimeAsync(waited * 2000);
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'blog-photos-'));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jpegResponse());
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe('writePhotoFiles', () => {
  it('writes every photo the posts and places list to public/blog/images, fetching each once, and removes any other file', async () => {
    await mkdir(path.join(root, 'public/blog/images'), { recursive: true });
    await writeFile(path.join(root, 'public/blog/images/retired-photo.jpg'), 'old');

    expect(await writePhotoFiles(fixtureCatalog, root)).toEqual({ written: 14, fetched: 14 });

    expect(await photosOnDisk()).toEqual(FIXTURE_PHOTOS);
    expect(new Uint8Array(await readFile(path.join(root, 'public/blog/images', SKYLINE)))).toEqual(
      JPEG_BYTES
    );
    expect([
      fetchMock.mock.calls.length,
      new Set(fetchMock.mock.calls.map(([url]) => url)).size,
    ]).toEqual([14, 14]);
  });

  it('writes each repo photo at the URL its sitemap entry and BlogPosting JSON-LD give', async () => {
    const catalog = await loadCatalog();
    const { written } = await writePhotoFiles(catalog, root);

    const sitemapImages = (await sitemap()).flatMap((entry) => entry.images ?? []);
    const jsonLdImages = listPages(catalog).flatMap((page) =>
      [
        ...renderToStaticMarkup(createElement(BlogPageView, { page, catalog })).matchAll(
          /"contentUrl":"([^"]+)"/g
        ),
      ].map(([, url]) => url)
    );
    const linked = [...new Set([...sitemapImages, ...jsonLdImages])].sort();

    expect(linked.map((url) => url.replace(`${ORIGIN}/blog/images/`, ''))).toEqual(
      await photosOnDisk()
    );
    expect(linked).toHaveLength(written);
  });

  it('reads a written photo back for the covers, and names the step when it is missing', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const [image] = catalogImages(skylineOnly()).values();
    await expect(readPhotoFile(image)).rejects.toThrow(
      `public/blog/images/${SKYLINE} is missing. Run npm run blog-photos.`
    );

    await writePhotoFiles(skylineOnly(), root);
    expect(new Uint8Array(await readPhotoFile(image))).toEqual(JPEG_BYTES);
  });

  it('keeps the photos it already wrote when a later build fails', async () => {
    await writePhotoFiles(fixtureCatalog, root);
    fetchMock.mockImplementation(async () => new Response('gone', { status: 404 }));
    await expect(writePhotoFiles(skylineOnly(`${SKYLINE_SOURCE}?gone`), root)).rejects.toThrow(
      `Wikimedia answered 404 for ${SKYLINE}`
    );
    expect(await photosOnDisk()).toEqual(FIXTURE_PHOTOS);
  });

  it('retries a download whose connection drops partway through the photo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const dropped = new ReadableStream({
      start(controller) {
        controller.error(new TypeError('terminated'));
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(dropped, { headers: { 'Content-Type': 'image/jpeg' } })
    );
    const written = writePhotoFiles(skylineOnly(), root);
    await vi.waitFor(() => expect(fetchMock.mock.calls).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await written).toEqual({ written: 1, fetched: 1 });
    expect([await photosOnDisk(), fetchMock.mock.calls.length]).toEqual([[SKYLINE], 2]);
  });

  it('asks Wikimedia for each photo with the User-Agent it requires', async () => {
    await writePhotoFiles(skylineOnly(), root);
    expect(fetchMock.mock.calls).toEqual([
      [
        SKYLINE_SOURCE,
        {
          headers: {
            'User-Agent':
              'Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)',
          },
          signal: expect.any(AbortSignal),
        },
      ],
    ]);
  });

  it('reuses a downloaded photo on the next build, and fetches it again when its source changes', async () => {
    expect(await writePhotoFiles(fixtureCatalog, root)).toEqual({ written: 14, fetched: 14 });

    await rm(path.join(root, 'public'), { recursive: true });
    fetchMock.mockClear();
    expect(await writePhotoFiles(fixtureCatalog, root)).toEqual({ written: 14, fetched: 0 });
    expect([(await photosOnDisk()).length, fetchMock.mock.calls]).toEqual([14, []]);

    const sourceUrl = `${SKYLINE_SOURCE}?moved`;
    expect(await writePhotoFiles(skylineOnly(sourceUrl), root)).toEqual({ written: 1, fetched: 1 });
    expect([await photosOnDisk(), fetchMock.mock.calls.map(([url]) => url)]).toEqual([
      [SKYLINE],
      [sourceUrl],
    ]);
  });

  it('refuses a photo that is not a JPEG, and keeps nothing of it', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response('<svg onload="alert(1)"/>', { headers: { 'Content-Type': 'image/svg+xml' } })
    );
    await expect(writePhotoFiles(skylineOnly(), root)).rejects.toThrow(
      `Wikimedia sent image/svg+xml for ${SKYLINE}`
    );
    expect(await photosOnDisk()).toEqual([]);

    fetchMock.mockImplementation(async () => jpegResponse());
    await writePhotoFiles(skylineOnly(), root);
    expect([await photosOnDisk(), fetchMock.mock.calls.length]).toEqual([[SKYLINE], 2]);
  });

  it('retries a fetch that times out, drops its connection or gets a 503, then fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock
      .mockRejectedValueOnce(
        new TypeError('fetch failed', {
          cause: Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        })
      )
      .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }));
    const failure = expect(writePhotoFiles(skylineOnly(), root)).rejects.toThrow(
      `Wikimedia answered 503 for ${SKYLINE}`
    );
    await advanceThroughRetries();
    await failure;
    expect(await photosOnDisk()).toEqual([]);
  });

  it('writes the photo after Wikimedia answers 503 and then 500', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('broken', { status: 500 }))
      .mockResolvedValueOnce(jpegResponse());
    const written = writePhotoFiles(skylineOnly(), root);
    await advanceThroughRetries();
    await written;
    expect([await photosOnDisk(), fetchMock.mock.calls.length]).toEqual([[SKYLINE], 3]);
  });

  it('says why Wikimedia could not be reached after the last try', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      })
    );
    const failure = expect(writePhotoFiles(skylineOnly(), root)).rejects.toThrow(
      `Wikimedia could not be reached (ECONNRESET) for ${SKYLINE}`
    );
    await advanceThroughRetries();
    await failure;
    expect(fetchMock.mock.calls).toHaveLength(3);
  });

  it('does not retry an answer that will not change, such as a 404', async () => {
    fetchMock.mockImplementation(async () => new Response('gone', { status: 404 }));
    await expect(writePhotoFiles(skylineOnly(), root)).rejects.toThrow(
      `Wikimedia answered 404 for ${SKYLINE}`
    );
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it('retries a rate-limited fetch twice, then fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    fetchMock.mockImplementation(async () => new Response('slow down', { status: 429 }));
    const failure = expect(writePhotoFiles(skylineOnly(), root)).rejects.toThrow(
      `Wikimedia answered 429 for ${SKYLINE}`
    );
    await advanceThroughRetries();
    await failure;
    expect(fetchMock.mock.calls).toHaveLength(3);
  });
});
