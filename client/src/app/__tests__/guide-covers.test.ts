import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as cityCover } from '@/app/(landing)/where-to-meet/[city]/cover.png/route';
import { GET as twoSegmentCover } from '@/app/(landing)/where-to-meet/[city]/[segment]/cover.png/route';
import { GET as townGuideCover } from '@/app/(landing)/where-to-meet/[city]/[segment]/[guide]/cover.png/route';
import fixture from '@/features/guides/__fixtures__/published.json';
import { listPages, pageSegments } from '@/features/guides/lib/catalog';
import { parsePublished } from '@/features/guides/lib/parse';

const FIXTURE_PATH = path.join(__dirname, '../../features/guides/__fixtures__/published.json');

/** Calls the cover route that serves a page `segments.length` levels below /where-to-meet. */
function cover([city, segment, guide]: string[]) {
  const request = new Request('http://localhost');
  if (guide) return townGuideCover(request, { params: Promise.resolve({ city, segment, guide }) });
  if (segment) return twoSegmentCover(request, { params: Promise.resolve({ city, segment }) });
  return cityCover(request, { params: Promise.resolve({ city }) });
}

beforeEach(() => {
  vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('local guide covers', () => {
  it.each(listPages(parsePublished(fixture).catalog).map((page) => pageSegments(page).join('/')))(
    'renders a 1200x630 PNG for /where-to-meet/%s',
    async (segments) => {
      const response = await cover(segments.split('/'));
      expect(response.headers.get('content-type')).toBe('image/png');

      const png = Buffer.from(await response.arrayBuffer());
      expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    }
  );

  it.each([
    'boston',
    'new-york/soho',
    'new-york/quiet-places-for-a-small-team-meeting',
    'new-york/midtown/coffee-shops-for-a-catch-up-near-union-square',
  ])('answers 404 for unpublished /where-to-meet/%s', async (segments) => {
    const response = await cover(segments.split('/'));
    expect([response.status, await response.text()]).toEqual([404, 'Not found']);
  });
});
