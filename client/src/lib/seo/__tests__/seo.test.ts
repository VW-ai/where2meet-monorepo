import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SITE_CONFIG,
  buildPageTitle,
  createArticleMetadata,
  createMeetingPageMetadata,
  createMetadata,
  toAbsoluteUrl,
} from '@/lib/seo/metadata';
import {
  generateBlogPostingSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebApplicationSchema,
} from '@/lib/seo/structured-data';
import { MDX_POSTS } from '@/content/blog/posts';
import {
  FIXTURE_FILES,
  fixtureContent,
  markdownFile,
  type FixtureFile,
} from '@/features/blog/__fixtures__/content-files';
import { postPath, postPhotos } from '@/features/blog/lib/catalog';
import { parseCatalog } from '@/features/blog/lib/parse';
import { buildLlmsTxt } from '@/lib/seo/llms-txt';
import { STATIC_PAGES } from '@/lib/seo/site-pages';
import { GET as getLlmsTxt } from '@/app/llms.txt/route';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import nextConfig from '../../../../next.config.js';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});

const CANONICAL_ORIGIN = 'https://www.where2meet.org';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGES = `${CANONICAL_ORIGIN}/blog/images`;
const REPO_URLS = [
  `${CANONICAL_ORIGIN}/blog/how-to-pick-a-restaurant-for-a-group-dinner`,
  `${CANONICAL_ORIGIN}/blog/how-to-pick-a-date-spot`,
  `${CANONICAL_ORIGIN}/blog/how-to-plan-a-weekend-hangout-with-friends`,
  `${CANONICAL_ORIGIN}/blog/how-to-choose-a-team-meeting-location`,
];

function readPostBody(slug: string) {
  return readFileSync(path.join(__dirname, `../../../content/blog/${slug}.mdx`), 'utf8');
}

async function llmsTxt() {
  return (await getLlmsTxt()).text();
}

function linksIn(text: string) {
  return [...text.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
}

/** The repo's own content unless a test adds the fixture files. */
afterEach(() => {
  disk.files = [];
});

/** Strip Next.js metadata union types by round-tripping through JSON. */
function asJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('SITE_CONFIG', () => {
  it('uses the canonical www host', () => {
    expect(SITE_CONFIG.url).toBe(CANONICAL_ORIGIN);
  });

  it('keeps the default description within the snippet window', () => {
    expect(SITE_CONFIG.description.length).toBeGreaterThanOrEqual(120);
    expect(SITE_CONFIG.description.length).toBeLessThanOrEqual(160);
  });

  it('resolves relative paths against the www host', () => {
    expect(toAbsoluteUrl('/faq')).toBe(`${CANONICAL_ORIGIN}/faq`);
    expect(toAbsoluteUrl('https://example.com/x')).toBe('https://example.com/x');
  });
});

describe('createMetadata', () => {
  it('appends the site name exactly once', () => {
    const metadata = createMetadata({ title: 'FAQ' });
    expect(metadata.title).toBe('FAQ | Where2Meet');
    expect(String(metadata.title).match(/Where2Meet/g)).toHaveLength(1);
  });

  it('falls back to the default title without a suffix', () => {
    expect(buildPageTitle()).toBe(SITE_CONFIG.defaultTitle);
    expect(createMetadata().title).toBe(SITE_CONFIG.defaultTitle);
  });

  it('does not emit a keywords meta tag', () => {
    expect(createMetadata({ title: 'Anything' })).not.toHaveProperty('keywords');
  });

  it('emits canonical and Open Graph URLs on the www host', () => {
    const metadata = asJson<{
      alternates: { canonical: string };
      openGraph: { url: string };
    }>(createMetadata({ title: 'FAQ', canonical: '/faq' }));

    expect(metadata.alternates.canonical).toBe(`${CANONICAL_ORIGIN}/faq`);
    expect(metadata.openGraph.url).toBe(`${CANONICAL_ORIGIN}/faq`);
  });

  it('links the site share image by default', () => {
    const metadata = asJson<{ openGraph: { images: unknown[] } }>(createMetadata({ title: 'FAQ' }));
    expect(metadata.openGraph.images).toEqual([
      {
        url: '/opengraph-image',
        alt: 'Where2Meet: Plan where to meet, together',
        width: 1200,
        height: 630,
      },
    ]);
  });

  it('builds article metadata with its own share image and dates', () => {
    const metadata = asJson<{
      title: string;
      alternates: { canonical: string };
      openGraph: { type: string; publishedTime: string; modifiedTime: string; images: unknown[] };
    }>(
      createArticleMetadata({
        title: 'A post',
        description: 'About a post',
        canonical: '/blog/a-post',
        image: { url: '/blog/a-post/cover.png', alt: 'The cover' },
        publishedTime: '2026-10-04',
        modifiedTime: '2026-10-05',
      })
    );
    expect(metadata.title).toBe('A post | Where2Meet');
    expect(metadata.alternates.canonical).toBe(`${CANONICAL_ORIGIN}/blog/a-post`);
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-10-04',
      modifiedTime: '2026-10-05',
      images: [{ url: '/blog/a-post/cover.png', alt: 'The cover', width: 1200, height: 630 }],
    });
  });

  it('marks meeting pages noindex but follow', () => {
    const metadata = asJson<{ robots: { index: boolean; follow: boolean } }>(
      createMeetingPageMetadata({ title: 'Team lunch', description: 'Vote on a spot' })
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});

describe('sitemap', () => {
  it('lists every public page and repo post once, each post with its cover', async () => {
    const entries = await sitemap();
    expect(entries.map(({ url, lastModified, images }) => [url, lastModified, images])).toEqual([
      [CANONICAL_ORIGIN, '2026-10-04', undefined],
      [`${CANONICAL_ORIGIN}/faq`, '2026-10-02', undefined],
      [`${CANONICAL_ORIGIN}/contact`, '2026-09-29', undefined],
      [`${CANONICAL_ORIGIN}/blog`, '2026-10-08', undefined],
      ...REPO_URLS.map((url) => [url, '2026-10-08', [`${url}/cover.png`]]),
    ]);
  });

  it('lists every post, city and town at its /blog URL with its update date and its photos', async () => {
    disk.files = [...FIXTURE_FILES];
    const blogEntries = (await sitemap()).filter((entry) =>
      entry.url.startsWith(`${CANONICAL_ORIGIN}/blog`)
    );
    expect(
      blogEntries.map(({ url, lastModified, images }) => [
        url.slice(CANONICAL_ORIGIN.length),
        lastModified,
        images?.map((image) => image.replace(CANONICAL_ORIGIN, '')),
      ])
    ).toEqual([
      ['/blog', '2026-10-08', undefined],
      [
        '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
        '2026-10-08',
        ['/blog/how-to-pick-a-restaurant-for-a-group-dinner/cover.png'],
      ],
      ['/blog/how-to-pick-a-date-spot', '2026-10-08', ['/blog/how-to-pick-a-date-spot/cover.png']],
      [
        '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
        '2026-10-08',
        [
          '/blog/images/bryant-park-carousel-midtown.jpg',
          '/blog/images/midtown-view-from-empire-state-building.jpg',
          '/blog/images/seventh-avenue-times-square-north.jpg',
        ],
      ],
      [
        '/blog/how-to-plan-a-team-welcome-lunch',
        '2026-10-08',
        [
          '/blog/images/grand-central-main-concourse-new-york.jpg',
          '/blog/images/rockefeller-center-concourse.jpg',
          '/blog/images/rockefeller-center-lights-at-sunset.jpg',
        ],
      ],
      [
        '/blog/new-york/group-dinner-spots-near-herald-square',
        '2026-10-07',
        [
          '/blog/images/herald-square-plaza-new-york.jpg',
          '/blog/images/times-square-crowds-new-york.jpg',
          '/blog/images/hot-dog-stand-times-square.jpg',
        ],
      ],
      [
        '/blog/how-to-plan-a-weekend-hangout-with-friends',
        '2026-10-08',
        ['/blog/how-to-plan-a-weekend-hangout-with-friends/cover.png'],
      ],
      [
        '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
        '2026-10-07',
        [
          '/blog/images/new-york-public-library-lion-midtown.jpg',
          '/blog/images/bryant-park-from-one-vanderbilt.jpg',
          '/blog/images/grand-central-concourse-windows.jpg',
        ],
      ],
      [
        '/blog/how-to-choose-a-team-meeting-location',
        '2026-10-08',
        ['/blog/how-to-choose-a-team-meeting-location/cover.png'],
      ],
      ['/blog/new-york', '2026-10-07', ['/blog/images/midtown-manhattan-skyline-new-york.jpg']],
      ['/blog/new-york/midtown', '2026-10-07', ['/blog/images/bryant-park-lawn-midtown.jpg']],
    ]);
  });

  it('uses fixed ISO content dates for lastModified, never the build time', async () => {
    disk.files = [...FIXTURE_FILES];
    const entries = await sitemap();
    for (const entry of entries) {
      expect(typeof entry.lastModified).toBe('string');
      expect(entry.lastModified).toMatch(ISO_DATE);
    }
    expect(await sitemap()).toEqual(entries);
  });

  it('never exposes meeting, dashboard or auth pages', async () => {
    disk.files = [...FIXTURE_FILES];
    for (const entry of await sitemap()) {
      expect(entry.url).not.toMatch(/\/(meet|dashboard|auth|api)\b/);
    }
  });
});

describe('robots', () => {
  const config = robots();
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

  it('points to the sitemap on the www host', () => {
    expect(config.sitemap).toBe(`${CANONICAL_ORIGIN}/sitemap.xml`);
  });

  it('has a wildcard rule plus explicit AI retrieval bot rules', () => {
    const agents = rules.flatMap((rule) => rule.userAgent ?? []);
    expect(agents).toContain('*');
    expect(agents).toEqual(
      expect.arrayContaining(['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot'])
    );
  });

  it('blocks private routes and the debug pages, but not meeting pages', () => {
    for (const rule of rules) {
      expect(rule.allow).toBe('/');
      expect(rule.disallow).toEqual(
        expect.arrayContaining([
          '/dashboard',
          '/auth/',
          '/api/',
          '/debug-claim-tokens.html',
          '/clear-invalid-tokens.html',
        ])
      );
      // Meeting pages carry a noindex meta tag; crawlers must be able to fetch it.
      expect(rule.disallow).not.toContain('/meet');
    }
  });
});

describe('structured data', () => {
  it('uses www URLs in the Organization schema', () => {
    const organization = generateOrganizationSchema();
    expect(organization.url).toBe(CANONICAL_ORIGIN);
    expect(organization.logo).toBe(`${CANONICAL_ORIGIN}/logo.png`);
  });

  it('describes a post as a BlogPosting with each photo as a credited, licensed ImageObject', () => {
    const catalog = parseCatalog(fixtureContent()).catalog;
    const post = catalog.posts.find(
      ({ slug }) => slug === 'group-dinner-spots-near-herald-square'
    )!;
    expect(
      generateBlogPostingSchema({
        title: post.title,
        description: post.description,
        path: postPath(post),
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        images: postPhotos(post).slice(0, 2),
      })
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Group dinner spots near Herald Square',
      description:
        'Sample post: group dinner spots near Herald Square that a big group can reach on one train, with tips on booking and getting home late.',
      image: [
        {
          '@type': 'ImageObject',
          contentUrl: `${IMAGES}/herald-square-plaza-new-york.jpg`,
          width: { '@type': 'QuantitativeValue', value: 1280, unitCode: 'E37' },
          height: { '@type': 'QuantitativeValue', value: 960, unitCode: 'E37' },
          caption: "Herald Square's plaza",
          creditText: 'Ypsilonatshared',
          creator: { '@type': 'Person', name: 'Ypsilonatshared' },
          acquireLicensePage: 'https://commons.wikimedia.org/wiki/File:Herald_Square_wts.jpg',
        },
        {
          '@type': 'ImageObject',
          contentUrl: `${IMAGES}/times-square-crowds-new-york.jpg`,
          width: { '@type': 'QuantitativeValue', value: 1280, unitCode: 'E37' },
          height: { '@type': 'QuantitativeValue', value: 854, unitCode: 'E37' },
          caption: 'Times Square, a few blocks north',
          creditText: 'Larry D. Moore',
          creator: { '@type': 'Person', name: 'Larry D. Moore' },
          license: 'https://creativecommons.org/licenses/by/4.0/',
          acquireLicensePage:
            'https://commons.wikimedia.org/wiki/File:Times_Square_New_York_May_2022.jpg',
        },
      ],
      datePublished: '2026-10-06',
      dateModified: '2026-10-07',
      author: { '@type': 'Organization', name: 'The Where2Meet team', url: CANONICAL_ORIGIN },
      publisher: { '@id': `${CANONICAL_ORIGIN}/#organization` },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${CANONICAL_ORIGIN}/blog/new-york/group-dinner-spots-near-herald-square`,
      },
    });
  });

  it('credits a repo post’s cover photo on its cover image', () => {
    const post = MDX_POSTS.find(
      ({ slug }) => slug === 'how-to-pick-a-restaurant-for-a-group-dinner'
    )!;
    expect(
      generateBlogPostingSchema({ ...post, path: postPath(post), images: postPhotos(post) }).image
    ).toEqual([
      {
        '@type': 'ImageObject',
        contentUrl: `${CANONICAL_ORIGIN}/blog/how-to-pick-a-restaurant-for-a-group-dinner/cover.png`,
        width: { '@type': 'QuantitativeValue', value: 1200, unitCode: 'E37' },
        height: { '@type': 'QuantitativeValue', value: 630, unitCode: 'E37' },
        caption: 'Koreatown',
        creditText: 'Jazz Guy',
        creator: { '@type': 'Person', name: 'Jazz Guy' },
        license: 'https://creativecommons.org/licenses/by/2.0/',
        acquireLicensePage:
          'https://commons.wikimedia.org/wiki/File:West_32nd_Street_(Korea_Way)_@_Broadway_(2559336247).jpg',
      },
    ]);
  });

  it('numbers breadcrumbs from 1 with absolute www URLs', () => {
    expect(
      generateBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
      ])
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${CANONICAL_ORIGIN}/blog` },
      ],
    });
  });

  it('describes a free web application without fabricated ratings', () => {
    const app = asJson<{ offers: { price: string }; aggregateRating?: unknown }>(
      generateWebApplicationSchema()
    );
    expect(app.offers.price).toBe('0');
    expect(app).not.toHaveProperty('aggregateRating');
  });
});

describe('next.config redirects and headers', () => {
  it('sends non-canonical hosts to www and keeps the retired-page redirects', async () => {
    const redirects = await nextConfig.redirects();
    for (const host of ['where2meet.org', 'where2meet-steel.vercel.app']) {
      expect(redirects).toContainEqual({
        source: '/:path*',
        has: [{ type: 'host', value: host }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      });
    }
    expect(redirects).toContainEqual({
      source: '/how-it-works',
      destination: '/',
      permanent: true,
    });
    for (const source of ['/scenarios', '/scenarios/:slug']) {
      expect(redirects).toContainEqual({ source, destination: '/blog', permanent: true });
    }
  });

  it('moves /where-to-meet and every path under it to the same path under /blog for good', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects.filter(({ source }) => source.startsWith('/where-to-meet'))).toEqual([
      { source: '/where-to-meet', destination: '/blog', permanent: true },
      { source: '/where-to-meet/:path*', destination: '/blog/:path*', permanent: true },
    ]);
  });

  it('marks the debug pages noindex', async () => {
    const headers = await nextConfig.headers();
    for (const source of ['/debug-claim-tokens.html', '/clear-invalid-tokens.html']) {
      expect(headers).toContainEqual({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      });
    }
  });
});

describe('llms.txt', () => {
  const pageUrls = STATIC_PAGES.map((page) =>
    page.path === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${page.path}`
  );

  it('is served as UTF-8 plain text', async () => {
    expect((await getLlmsTxt()).headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('links the pages, then every post by its /blog URL newest first, then cities and towns', async () => {
    disk.files = [...FIXTURE_FILES];
    expect(linksIn(await llmsTxt())).toEqual([
      ...pageUrls.slice(0, 2),
      `${CANONICAL_ORIGIN}/blog`,
      `${CANONICAL_ORIGIN}/blog/how-to-pick-a-restaurant-for-a-group-dinner`,
      `${CANONICAL_ORIGIN}/blog/how-to-pick-a-date-spot`,
      `${CANONICAL_ORIGIN}/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park`,
      `${CANONICAL_ORIGIN}/blog/how-to-plan-a-team-welcome-lunch`,
      `${CANONICAL_ORIGIN}/blog/new-york/group-dinner-spots-near-herald-square`,
      `${CANONICAL_ORIGIN}/blog/how-to-plan-a-weekend-hangout-with-friends`,
      `${CANONICAL_ORIGIN}/blog/new-york/midtown/quiet-places-for-a-small-team-meeting`,
      `${CANONICAL_ORIGIN}/blog/how-to-choose-a-team-meeting-location`,
      `${CANONICAL_ORIGIN}/contact`,
      `${CANONICAL_ORIGIN}/blog/new-york`,
      `${CANONICAL_ORIGIN}/blog/new-york/midtown`,
      `${CANONICAL_ORIGIN}/sitemap.xml`,
    ]);
  });

  it('links a post and a place with their descriptions', async () => {
    disk.files = [...FIXTURE_FILES];
    const lines = (await llmsTxt()).split('\n');
    expect(lines.filter((line) => /herald-square|new-york\)/.test(line))).toEqual([
      `- [Group dinner spots near Herald Square](${CANONICAL_ORIGIN}/blog/new-york/group-dinner-spots-near-herald-square): Sample post: group dinner spots near Herald Square that a big group can reach on one train, with tips on booking and getting home late.`,
      `- [Where to meet in New York](${CANONICAL_ORIGIN}/blog/new-york): Sample page: places in New York that work for groups, from team lunches to group dinners, plus how to get around by subway.`,
    ]);
  });

  it('links only the MDX posts and leaves out the cities section without place files', async () => {
    const text = await llmsTxt();
    expect(text).not.toContain('## Cities and towns');
    expect(linksIn(text)).toEqual([
      ...pageUrls.slice(0, 2),
      `${CANONICAL_ORIGIN}/blog`,
      ...REPO_URLS,
      `${CANONICAL_ORIGIN}/contact`,
      `${CANONICAL_ORIGIN}/sitemap.xml`,
    ]);
  });

  it('keeps place copy on one list line with its link intact', () => {
    const testville = markdownFile(
      'testville.md',
      {
        name: 'Testville',
        region: 'TV',
        country: 'US',
        center: { lat: 42.36, lng: -71.06 },
        updated_at: '2026-10-05',
        seo: { title: 'Where to meet [beta]', description: 'Two lines\nof copy.' },
      },
      'Hello\n'
    );
    const { catalog } = parseCatalog({ ...fixtureContent([]), mdx: [], places: [testville] });
    expect(buildLlmsTxt(catalog)).toContain(
      `- [Where to meet \\[beta\\]](${CANONICAL_ORIGIN}/blog/testville): Two lines of copy.\n`
    );
  });
});

describe('positioning copy', () => {
  it('never calls the spot fair or says "meet in the middle"', async () => {
    disk.files = [...FIXTURE_FILES];
    for (const text of [
      SITE_CONFIG.defaultTitle,
      SITE_CONFIG.description,
      SITE_CONFIG.tagline,
      SITE_CONFIG.pitch,
      await llmsTxt(),
      ...MDX_POSTS.flatMap((post) => [post.title, post.description, readPostBody(post.slug)]),
      ...FIXTURE_FILES.map(({ text }) => text),
    ]) {
      expect(text).not.toMatch(/\bfair/i);
      expect(text).not.toMatch(/meet in the middle/i);
    }
  });
});
