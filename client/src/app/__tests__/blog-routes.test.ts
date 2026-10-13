import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as oneSegment from '@/app/(landing)/blog/[slug]/page';
import * as twoSegments from '@/app/(landing)/blog/[slug]/[segment]/page';
import * as townPost from '@/app/(landing)/blog/[slug]/[segment]/[post]/page';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});

const ORIGIN = 'https://www.where2meet.org';
const NOT_FOUND = { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' };

async function metadata(segments: string) {
  const [slug, segment, post] = segments.split('/');
  const result = post
    ? await townPost.generateMetadata({ params: Promise.resolve({ slug, segment, post }) })
    : segment
      ? await twoSegments.generateMetadata({ params: Promise.resolve({ slug, segment }) })
      : await oneSegment.generateMetadata({ params: Promise.resolve({ slug }) });
  return JSON.parse(JSON.stringify(result)) as {
    title: string;
    alternates: { canonical: string };
    openGraph: { type: string; url: string; images: { url: string; alt: string }[] };
  };
}

beforeEach(() => {
  disk.files = [...FIXTURE_FILES];
});

afterEach(() => {
  disk.files = [];
});

describe('/blog routes', () => {
  it('prerenders MDX posts, general posts and cities one level below /blog', async () => {
    expect(await oneSegment.generateStaticParams()).toEqual([
      { slug: 'how-to-pick-a-restaurant-for-a-group-dinner' },
      { slug: 'how-to-pick-a-date-spot' },
      { slug: 'how-to-plan-a-team-welcome-lunch' },
      { slug: 'how-to-plan-a-weekend-hangout-with-friends' },
      { slug: 'how-to-choose-a-team-meeting-location' },
      { slug: 'new-york' },
    ]);
  });

  it('prerenders towns and city posts below their city, and town posts below their town', async () => {
    expect(await twoSegments.generateStaticParams()).toEqual([
      { slug: 'new-york', segment: 'group-dinner-spots-near-herald-square' },
      { slug: 'new-york', segment: 'midtown' },
    ]);
    expect(await townPost.generateStaticParams()).toEqual([
      { slug: 'new-york', segment: 'midtown', post: 'a-team-welcome-lunch-in-bryant-park' },
      { slug: 'new-york', segment: 'midtown', post: 'quiet-places-for-a-small-team-meeting' },
    ]);
  });

  it('prerenders no city or local post when the repo has no place files', async () => {
    disk.files = FIXTURE_FILES.filter((file) => !file.path.startsWith('src/content/places/'));
    expect(await oneSegment.generateStaticParams()).toEqual([
      { slug: 'how-to-pick-a-restaurant-for-a-group-dinner' },
      { slug: 'how-to-pick-a-date-spot' },
      { slug: 'how-to-plan-a-team-welcome-lunch' },
      { slug: 'how-to-plan-a-weekend-hangout-with-friends' },
      { slug: 'how-to-choose-a-team-meeting-location' },
    ]);
    expect(await twoSegments.generateStaticParams()).toEqual([]);
    expect(await townPost.generateStaticParams()).toEqual([]);
  });

  it.each([
    'images',
    'midtown',
    'new-york/soho',
    'new-york/quiet-places-for-a-small-team-meeting',
    'new-york/midtown/group-dinner-spots-near-herald-square',
  ])('answers 404 for unpublished /blog/%s', async (segments) => {
    await expect(metadata(segments)).rejects.toMatchObject(NOT_FOUND);
  });

  it.each([
    [
      'how-to-choose-a-team-meeting-location',
      'article',
      "Herald Square's plaza and memorial clock in Midtown Manhattan, next to the article title.",
    ],
    [
      'how-to-plan-a-team-welcome-lunch',
      'article',
      "Grand Central Terminal's main concourse with its clock and ticket windows, next to the title.",
    ],
    [
      'new-york',
      'website',
      'The Midtown Manhattan skyline with the Empire State Building, next to the title.',
    ],
    [
      'new-york/midtown',
      'website',
      "Bryant Park's lawn and stage on a sunny afternoon, next to the title.",
    ],
    [
      'new-york/group-dinner-spots-near-herald-square',
      'article',
      "Herald Square's plaza and memorial clock in Midtown Manhattan, next to the title.",
    ],
    [
      'new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      'article',
      'The carousel in Bryant Park with Midtown towers behind it, next to the title.',
    ],
  ])('makes /blog/%s canonical at its /blog URL with its cover', async (segments, type, alt) => {
    const { alternates, openGraph } = await metadata(segments);
    const url = `${ORIGIN}/blog/${segments}`;
    expect([alternates.canonical, openGraph.url, openGraph.type]).toEqual([url, url, type]);
    expect(openGraph.images).toEqual([
      { url: `/blog/${segments}/cover.png`, alt, width: 1200, height: 630 },
    ]);
  });
});
