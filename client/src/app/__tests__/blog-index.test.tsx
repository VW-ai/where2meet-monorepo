import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BlogIndexPage from '@/app/(landing)/blog/page';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});

beforeEach(() => {
  disk.files = [...FIXTURE_FILES];
});

afterEach(() => {
  disk.files = [];
});

async function render() {
  return renderToStaticMarkup(await BlogIndexPage())
    .replace(/ (class|srcSet|decoding|style|data-nimg)="[^"]*"/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'");
}

describe('/blog', () => {
  it('tops each post card with its cover photo and credits it, loading only the first at once', async () => {
    const html = await render();
    const cards = [...html.matchAll(/<article>(.*?)<\/article>/g)].map(([, card]) => {
      const [, alt, loading, width, height, sizes, src] =
        card.match(
          /<img alt="([^"]*)" (.*?) width="(\d+)" height="(\d+)" sizes="([^"]+)" src="([^"]+)"/
        ) ?? [];
      const href = card.match(/<h2><a href="([^"]+)">/)?.[1];
      const credit = card.match(/<p>(Photo by .*?)<\/p><\/div>$/)?.[1];
      return [
        href,
        alt,
        loading,
        `${width}x${height}`,
        sizes,
        decodeURIComponent(src),
        credit,
      ].join(' | ');
    });
    const sizes = '(min-width: 896px) 864px, calc(100vw - 32px)';

    expect(cards).toEqual([
      `/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park | The carousel in Bryant Park with Midtown towers behind it | fetchPriority="high" loading="eager" | 1280x960 | ${sizes} | /_next/image?url=/blog/images/bryant-park-carousel-midtown.jpg&w=3840&q=75 | Photo by Mathieu Brossais (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, cropped) via <a href="https://commons.wikimedia.org/wiki/File:Carrousel_de_Bryant_Park_%C3%A0_Manhattan.jpg">Wikimedia Commons</a>`,
      `/blog/how-to-plan-a-team-welcome-lunch | Grand Central Terminal's main concourse with its clock and ticket windows | loading="lazy" | 1280x960 | ${sizes} | /_next/image?url=/blog/images/grand-central-main-concourse-new-york.jpg&w=3840&q=75 | Photo by Warren LeMay (<a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>) via <a href="https://commons.wikimedia.org/wiki/File:Main_Concourse,_Grand_Central_Terminal,_New_York_City,_NY_-_48046500922.jpg">Wikimedia Commons</a>`,
      `/blog/new-york/group-dinner-spots-near-herald-square | Herald Square's plaza and memorial clock in Midtown Manhattan | loading="lazy" | 1280x960 | ${sizes} | /_next/image?url=/blog/images/herald-square-plaza-new-york.jpg&w=3840&q=75 | Photo by Ypsilonatshared (Public domain) via <a href="https://commons.wikimedia.org/wiki/File:Herald_Square_wts.jpg">Wikimedia Commons</a>`,
      `/blog/new-york/midtown/quiet-places-for-a-small-team-meeting | The stone lion outside the New York Public Library's main branch | loading="lazy" | 1280x960 | ${sizes} | /_next/image?url=/blog/images/new-york-public-library-lion-midtown.jpg&w=3840&q=75 | Photo by John Dillenbeck (<a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>) via <a href="https://commons.wikimedia.org/wiki/File:New_York_Public_Library_Main_Branch_Lion.jpg">Wikimedia Commons</a>`,
    ]);
    expect(html).not.toContain('cover.png');
  });

  it('puts no link inside another link, so the page hydrates', async () => {
    const html = await render();
    expect([
      html.match(/<a [^>]*>(?:(?!<\/a>).)*<a /s)?.[0] ?? null,
      html.match(/<article>/g)?.length,
    ]).toEqual([null, 4]);
  });
});
