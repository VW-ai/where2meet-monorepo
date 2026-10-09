import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as oneSegmentCover } from '@/app/(landing)/blog/[slug]/cover.png/route';
import { GET as twoSegmentCover } from '@/app/(landing)/blog/[slug]/[segment]/cover.png/route';
import { GET as townPostCover } from '@/app/(landing)/blog/[slug]/[segment]/[post]/cover.png/route';

const FIXTURE_PATH = path.join(__dirname, '../../features/blog/__fixtures__/published.json');
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
/** Any JPEG stands in for Wikimedia's answer. */
const JPEG = readFileSync(
  path.join(__dirname, '../../content/blog/covers/how-to-pick-a-date-spot.jpg')
);

/** Calls the cover route for the page `segments.length` levels below /blog. */
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

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JPEG));

beforeEach(() => {
  vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('blog covers', () => {
  it.each([
    ['how-to-choose-a-team-meeting-location', []],
    ['how-to-pick-a-date-spot', []],
    ['how-to-pick-a-restaurant-for-a-group-dinner', []],
    ['how-to-plan-a-weekend-hangout-with-friends', []],
    [
      'how-to-plan-a-team-welcome-lunch',
      [
        `${COMMONS}/thumb/9/94/Main_Concourse%2C_Grand_Central_Terminal%2C_New_York_City%2C_NY_-_48046500922.jpg/1280px-Main_Concourse%2C_Grand_Central_Terminal%2C_New_York_City%2C_NY_-_48046500922.jpg`,
      ],
    ],
    [
      'new-york',
      [`${COMMONS}/thumb/5/5e/Midtown_Manhattan_2019.jpg/1280px-Midtown_Manhattan_2019.jpg`],
    ],
    ['new-york/midtown', [`${COMMONS}/thumb/5/58/Bryant_Park_jeh.JPG/1280px-Bryant_Park_jeh.JPG`]],
    [
      'new-york/group-dinner-spots-near-herald-square',
      [`${COMMONS}/thumb/7/78/Herald_Square_wts.jpg/1280px-Herald_Square_wts.jpg`],
    ],
    [
      'new-york/midtown/quiet-places-for-a-small-team-meeting',
      [
        `${COMMONS}/thumb/1/13/New_York_Public_Library_Main_Branch_Lion.jpg/1280px-New_York_Public_Library_Main_Branch_Lion.jpg`,
      ],
    ],
    [
      'new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      [
        `${COMMONS}/thumb/3/34/Carrousel_de_Bryant_Park_%C3%A0_Manhattan.jpg/1280px-Carrousel_de_Bryant_Park_%C3%A0_Manhattan.jpg`,
      ],
    ],
  ])('draws a 1200x630 PNG for /blog/%s from its cover photo', async (segments, fetched) => {
    expect(await pngSize(await cover(segments.split('/')))).toEqual([1200, 630]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(fetched);
  });

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
