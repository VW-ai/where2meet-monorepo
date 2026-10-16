import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as oneSegmentCover } from '@/app/(landing)/blog/[slug]/cover.png/route';
import { GET as twoSegmentCover } from '@/app/(landing)/blog/[slug]/[segment]/cover.png/route';
import { GET as townPostCover } from '@/app/(landing)/blog/[slug]/[segment]/[post]/cover.png/route';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({
  files: [] as FixtureFile[],
  photosRead: [] as string[],
  greyPixelJpeg: Buffer.from(
    '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AA//Z',
    'base64'
  ),
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  const fs = withContentFiles(await importOriginal(), () => disk.files);
  const publicDir = path.join(process.cwd(), 'public');
  const readFile = (async (target: string, ...rest: [BufferEncoding]) => {
    if (!target.startsWith(path.join(publicDir, 'blog/images/')))
      return fs.readFile(target, ...rest);
    disk.photosRead.push(path.relative(publicDir, target));
    return disk.greyPixelJpeg;
  }) as typeof fs.readFile;
  return { ...fs, readFile };
});

function cover([slug, segment, post]: string[]) {
  const request = new Request('http://localhost');
  if (post) return townPostCover(request, { params: Promise.resolve({ slug, segment, post }) });
  if (segment) return twoSegmentCover(request, { params: Promise.resolve({ slug, segment }) });
  return oneSegmentCover(request, { params: Promise.resolve({ slug }) });
}

async function pngSize(response: Response) {
  expect(response.headers.get('content-type')).toBe('image/png');
  const png = Buffer.from(await response.arrayBuffer());
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('unexpected'));

beforeEach(() => {
  disk.files = [...FIXTURE_FILES];
  disk.photosRead = [];
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  disk.files = [];
  vi.unstubAllGlobals();
});

describe('blog covers', () => {
  it.each([
    ['how-to-plan-a-team-welcome-lunch', 'grand-central-main-concourse-new-york.jpg'],
    ['new-york', 'midtown-manhattan-skyline-new-york.jpg'],
    ['new-york/midtown', 'bryant-park-lawn-midtown.jpg'],
    ['new-york/group-dinner-spots-near-herald-square', 'herald-square-plaza-new-york.jpg'],
    [
      'new-york/midtown/quiet-places-for-a-small-team-meeting',
      'new-york-public-library-lion-midtown.jpg',
    ],
    ['new-york/midtown/a-team-welcome-lunch-in-bryant-park', 'bryant-park-carousel-midtown.jpg'],
  ])(
    'draws a 1200x630 PNG for /blog/%s from its cover photo file, without fetching',
    async (segments, photo) => {
      expect(await pngSize(await cover(segments.split('/')))).toEqual([1200, 630]);
      expect([disk.photosRead, fetchMock.mock.calls]).toEqual([[`blog/images/${photo}`], []]);
    }
  );

  it.each([
    'boston',
    'images',
    'new-york/soho',
    'new-york/quiet-places-for-a-small-team-meeting',
    'new-york/midtown/group-dinner-spots-near-herald-square',
  ])('answers 404 for unpublished /blog/%s', async (segments) => {
    const response = await cover(segments.split('/'));
    expect([response.status, await response.text()]).toEqual([404, 'Not found']);
  });
});
