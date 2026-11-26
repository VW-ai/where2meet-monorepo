import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '@/app/(landing)/page';
import {
  FIXTURE_FILES,
  markdownFile,
  type FixtureFile,
} from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

const newYork = FIXTURE_FILES.find(({ path }) => path === 'src/content/places/new-york.md')!;

function cityFile(slug: string, name: string, license = 'CC0'): FixtureFile {
  return {
    path: `src/content/places/${slug}.md`,
    text: newYork.text
      .replace('name: New York', `name: ${name}`)
      .replace('title: Where to meet in New York', `title: Where to meet in ${name}`)
      .replace('file_name: midtown-manhattan-skyline-new-york.jpg', `file_name: ${slug}-sample.jpg`)
      .replace('license: CC0', `license: ${license}`),
  };
}

function cityPost(city: string, slug: string, occasion: string): FixtureFile {
  const fileName = `${slug}.jpg`;
  return {
    path: `src/content/posts/${slug}.md`,
    text: markdownFile(
      `${slug}.md`,
      {
        title: `Guide ${slug}`,
        description: `Guide ${slug}, near a station.`,
        occasion,
        city,
        town: null,
        published_at: '2026-11-01',
        updated_at: '2026-11-01',
        images: [
          {
            file_name: fileName,
            source_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${fileName}/1280px-${fileName}`,
            page_url: `https://commons.wikimedia.org/wiki/File:${fileName}`,
            width: 1280,
            height: 960,
            alt: `Guide ${slug}`,
            author: 'Phi',
            license: 'CC0',
          },
        ],
      },
      '## Where to go\n\nNear a station.\n'
    ).text,
  };
}

beforeEach(() => {
  disk.files = [...FIXTURE_FILES, cityFile('boston', 'Boston')];
});

afterEach(() => {
  disk.files = [];
});

async function renderMain() {
  const html = renderToStaticMarkup(await LandingPage())
    .replace(/ (class|style|aria-hidden|id|aria-labelledby|data-leave)="[^"]*"/g, '')
    .replace(/<svg.*?<\/svg>/gs, '')
    .replaceAll('&#x27;', "'");
  return html.match(/<main>(.*)<\/main>/s)?.[1] ?? '';
}

const text = (html: string) => html.replace(/<[^>]+>/g, '');

async function cityTiles() {
  const main = await renderMain();
  const row = main.match(/<h2>Guides by city<\/h2><ul>(.*?)<\/ul>/s)?.[1] ?? '';
  return [...row.matchAll(/<li>(.*?)<\/li>/gs)].map(([, tile]) => {
    const [, href, name] = tile.match(/<h3><a href="([^"]+)">(.*?)<\/a><\/h3>/) ?? [];
    const [occasions, credit] = [...tile.matchAll(/<p>(.*?)<\/p>/g)].map(([, line]) => text(line));
    return { href, name, photo: tile.match(/<img[^>]* alt="([^"]*)"/)?.[1], occasions, credit };
  });
}

describe('the homepage', () => {
  it('keeps the create form first, then shows only the city guides', async () => {
    const main = await renderMain();
    const outline = [
      ...main.matchAll(/<(h[123])>(.*?)<\/\1>|<button[^>]*>(Create Meeting)<\/button>/g),
    ];

    expect(outline.map(([, tag, heading, button]) => button ?? `${tag} ${text(heading)}`)).toEqual([
      'h1 Plan where to meet, together',
      'Create Meeting',
      'h2 Guides by city',
      'h3 New York',
    ]);
    expect(text(main.match(/<section>(?:(?!<section>).)*$/s)?.[0] ?? '')).toBe(
      'Guides by cityNew YorkTeam welcome · Group dinner'
    );
  });

  it('server-renders the phone home with its heading, date card and start button', async () => {
    const html = renderToStaticMarkup(await LandingPage()).replaceAll('&#x27;', "'");
    const phone = html.match(/<section class="pp-create-home"[^>]*>(.*?)<\/section>/s)?.[1] ?? '';

    expect(phone).toContain('<h1>Plan where to meet, together.</h1>');
    expect(text(phone)).toContain('When are you meeting?');
    expect(text(phone)).toContain('Name your event to start');
  });

  it("links each city that has guides, with its photo and its guides' occasions", async () => {
    expect(await cityTiles()).toEqual([
      {
        href: '/blog/new-york',
        name: 'New York',
        photo: 'The Midtown Manhattan skyline with the Empire State Building',
        occasions: 'Team welcome · Group dinner',
        credit: undefined,
      },
    ]);
  });

  it('credits a photo whose license asks for a credit', async () => {
    disk.files = [
      ...FIXTURE_FILES,
      cityFile('boston', 'Boston', 'CC BY 4.0'),
      cityPost('boston', 'team-meeting-boston', 'team-meeting'),
    ];

    expect((await cityTiles()).map(({ name, credit }) => [name, credit])).toEqual([
      ['New York', undefined],
      ['Boston', 'Photo by CommunistSquared (CC BY 4.0, cropped) via Wikimedia Commons'],
    ]);
  });

  it('puts the city with the most guides first and names its two most common occasions', async () => {
    const guides = { 'team-meeting': 3, 'group-dinner': 2, 'date-night': 1 };
    disk.files.push(
      ...Object.entries(guides).flatMap(([occasion, count]) =>
        Array.from({ length: count }, (_, index) =>
          cityPost('boston', `${occasion}-${index}-boston`, occasion)
        )
      )
    );

    expect((await cityTiles()).map(({ name, occasions }) => `${name} | ${occasions}`)).toEqual([
      'Boston | Team meeting · Group dinner',
      'New York | Team welcome · Group dinner',
    ]);
  });

  it('leaves out a city that has no photo', async () => {
    const boston = cityFile('boston', 'Boston');
    disk.files = [
      ...FIXTURE_FILES,
      { ...boston, text: boston.text.replace(/image:\n(?: {2}.*\n)+/, '') },
      cityPost('boston', 'team-meeting-boston', 'team-meeting'),
    ];

    expect((await cityTiles()).map(({ name }) => name)).toEqual(['New York']);
  });

  it('shows five cities at most', async () => {
    const more = { austin: 'Austin', chicago: 'Chicago', denver: 'Denver', seattle: 'Seattle' };
    disk.files.push(
      cityPost('boston', 'team-meeting-boston', 'team-meeting'),
      ...Object.entries(more).flatMap(([slug, name]) => [
        cityFile(slug, name),
        cityPost(slug, `team-meeting-${slug}`, 'team-meeting'),
      ])
    );

    expect((await cityTiles()).map(({ name }) => name)).toEqual([
      'New York',
      'Austin',
      'Boston',
      'Chicago',
      'Denver',
    ]);
  });
});
