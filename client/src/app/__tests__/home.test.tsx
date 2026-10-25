import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '@/app/(landing)/page';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

const newYork = FIXTURE_FILES.find(({ path }) => path === 'src/content/places/new-york.md')!;
const boston: FixtureFile = {
  path: 'src/content/places/boston.md',
  text: newYork.text
    .replace('name: New York', 'name: Boston')
    .replace('title: Where to meet in New York', 'title: Where to meet up in Boston')
    .replace('file_name: midtown-manhattan-skyline-new-york.jpg', 'file_name: boston-sample.jpg'),
};

beforeEach(() => {
  disk.files = [...FIXTURE_FILES, boston];
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

describe('the homepage', () => {
  it('keeps the create form first, then says what Where2Meet is and how it works', async () => {
    const main = await renderMain();
    const outline = [
      ...main.matchAll(/<(h[123])>(.*?)<\/\1>|<button[^>]*>(Create Meeting)<\/button>/g),
    ];

    expect(outline.map(([, tag, heading, button]) => button ?? `${tag} ${heading}`)).toEqual([
      'h1 Plan where to meet, together',
      'Create Meeting',
      'h2 A group meetup planner with real travel times',
      'h2 Plan together in three steps',
      'h3 Add where everyone starts',
      'h3 Compare travel times on the map',
      'h3 Vote and share the spot',
      'h2 Guides to where to meet',
      'h3 By city',
      'h3 By occasion',
    ]);
    expect(text(main.match(/<h2>A group meetup planner.*?<\/h2><p>(.*?)<\/p>/)?.[1] ?? '')).toBe(
      "Where2Meet is a free group planning app for deciding where to meet. Everyone adds where they're coming from, and one map shows each person's real travel time by car, transit, walking or bike. Then the group votes on a convenient spot, and nobody has to sign up."
    );
    expect(
      [...(main.match(/<ol>(.*?)<\/ol>/s)?.[1] ?? '').matchAll(/<li>(.*?)<\/li>/g)].map(
        ([, step]) => text(step.replace(/<\/h3>/, '. '))
      )
    ).toEqual([
      '1Add where everyone starts. Share the link, and each person adds a cross street, station or neighborhood. The organizer can add people too.',
      "2Compare travel times on the map. Search places around the group or by name. Open one to see each person's travel time and route on the map.",
      '3Vote and share the spot. Everyone votes on where to meet. The organizer picks the final spot, and everyone with the link sees it without a refresh.',
    ]);
  });

  it('links each city page, most guides first, and the newest guide for each occasion chip, by their titles', async () => {
    const main = await renderMain();
    const links = (heading: string) =>
      [
        ...(main.match(new RegExp(`<h3>${heading}</h3><ul>(.*?)</ul>`))?.[1] ?? '').matchAll(
          /<a href="([^"]+)">(.*?)<\/a>/g
        ),
      ].map(([, href, title]) => `${href} | ${title}`);

    expect(links('By city')).toEqual([
      '/blog/new-york | Where to meet in New York',
      '/blog/boston | Where to meet up in Boston',
    ]);
    expect(links('By occasion')).toEqual([
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting | Quiet places for a small team meeting in Midtown',
      '/blog/new-york/group-dinner-spots-near-herald-square | Group dinner spots near Herald Square',
    ]);
  });
});
