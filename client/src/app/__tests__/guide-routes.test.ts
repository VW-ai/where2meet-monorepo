import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as cityRoute from '@/app/(landing)/where-to-meet/[city]/page';
import * as segmentRoute from '@/app/(landing)/where-to-meet/[city]/[segment]/page';
import * as townGuideRoute from '@/app/(landing)/where-to-meet/[city]/[segment]/[guide]/page';

const FIXTURE_PATH = path.join(__dirname, '../../features/guides/__fixtures__/published.json');
const ORIGIN = 'https://www.where2meet.org';
/** What Next's `notFound()` throws in this version, which it turns into a 404 page. */
const NOT_FOUND = { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' };

function metadata(segments: string) {
  const [city, segment, guide] = segments.split('/');
  if (guide) {
    return townGuideRoute.generateMetadata({ params: Promise.resolve({ city, segment, guide }) });
  }
  if (segment) return segmentRoute.generateMetadata({ params: Promise.resolve({ city, segment }) });
  return cityRoute.generateMetadata({ params: Promise.resolve({ city }) });
}

beforeEach(() => {
  vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('local guide routes', () => {
  it('prerenders each city hub', async () => {
    expect(await cityRoute.generateStaticParams()).toEqual([{ city: 'new-york' }]);
  });

  it('prerenders each city guide and town hub one level below its city', async () => {
    expect(await segmentRoute.generateStaticParams()).toEqual([
      { city: 'new-york', segment: 'coffee-shops-for-a-catch-up-near-union-square' },
      { city: 'new-york', segment: 'a-weekend-afternoon-in-bryant-park-with-friends' },
      { city: 'new-york', segment: 'midtown' },
    ]);
  });

  it('prerenders each town guide below its town', async () => {
    expect(await townGuideRoute.generateStaticParams()).toEqual([
      { city: 'new-york', segment: 'midtown', guide: 'quiet-places-for-a-small-team-meeting' },
      { city: 'new-york', segment: 'midtown', guide: 'bookable-rooms-for-a-big-team-meeting' },
      { city: 'new-york', segment: 'midtown', guide: 'a-team-welcome-lunch-in-bryant-park' },
    ]);
  });

  it.each([
    'new-york/soho',
    'new-york/quiet-places-for-a-small-team-meeting',
    'new-york/midtown/coffee-shops-for-a-catch-up-near-union-square',
  ])('answers 404 for unpublished /where-to-meet/%s', async (segments) => {
    await expect(metadata(segments)).rejects.toMatchObject(NOT_FOUND);
  });

  it.each([
    [
      'new-york/coffee-shops-for-a-catch-up-near-union-square',
      `${ORIGIN}/where-to-meet/new-york/coffee-shops-for-a-catch-up-near-union-square`,
    ],
    [
      'new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      `${ORIGIN}/where-to-meet/new-york/midtown/a-team-welcome-lunch-in-bryant-park`,
    ],
  ])('makes the guide at /where-to-meet/%s canonical at its slug URL', async (segments, url) => {
    const { alternates, openGraph } = JSON.parse(JSON.stringify(await metadata(segments))) as {
      alternates: { canonical: string };
      openGraph: { url: string };
    };
    expect([alternates.canonical, openGraph.url]).toEqual([url, url]);
  });
});
