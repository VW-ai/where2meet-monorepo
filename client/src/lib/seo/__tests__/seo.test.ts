import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { BLOG_POSTS, coverPath, getPost, postPath } from '@/content/blog/posts';
import fixture from '@/features/guides/__fixtures__/published.json';
import { listPages, pagePath } from '@/features/guides/lib/catalog';
import { parsePublished } from '@/features/guides/lib/parse';
import { buildLlmsTxt } from '@/lib/seo/llms-txt';
import { STATIC_PAGES } from '@/lib/seo/site-pages';
import { GET as getLlmsTxt } from '@/app/llms.txt/route';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import nextConfig from '../../../../next.config.js';

const CANONICAL_ORIGIN = 'https://www.where2meet.org';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIXTURE_PATH = path.join(__dirname, '../../../features/guides/__fixtures__/published.json');
const FIXTURE_GUIDE_URLS = [
  `${CANONICAL_ORIGIN}/where-to-meet`,
  ...listPages(parsePublished(fixture).catalog).map(
    (page) => `${CANONICAL_ORIGIN}${pagePath(page)}`
  ),
];
const BLOG_URLS = [
  `${CANONICAL_ORIGIN}/blog`,
  ...BLOG_POSTS.map((post) => `${CANONICAL_ORIGIN}${postPath(post.slug)}`),
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

/** Every string in a JSON value, for scanning copy. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** No published guides unless a test points the loader at the fixture. */
beforeEach(() => {
  vi.stubEnv('CONTROL_PLANE_FIXTURE', '');
  vi.stubEnv('CONTROL_PLANE_URL', '');
  vi.stubEnv('CONTROL_PLANE_READ_TOKEN', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
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
  it('lists every public page exactly once', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual([
      CANONICAL_ORIGIN,
      `${CANONICAL_ORIGIN}/faq`,
      `${CANONICAL_ORIGIN}/contact`,
      `${CANONICAL_ORIGIN}/blog`,
      `${CANONICAL_ORIGIN}/blog/how-to-plan-a-weekend-hangout-with-friends`,
      `${CANONICAL_ORIGIN}/blog/how-to-choose-a-team-meeting-location`,
    ]);
  });

  it('dates each post by its update and the blog by its newest post', async () => {
    const blogEntries = (await sitemap()).filter((entry) =>
      entry.url.startsWith(`${CANONICAL_ORIGIN}/blog`)
    );
    expect(blogEntries.map((entry) => entry.lastModified)).toEqual([
      '2026-10-08',
      '2026-10-08',
      '2026-10-08',
    ]);
  });

  it('lists the guides index, every hub and every guide by its update date', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    const guideEntries = (await sitemap()).filter((entry) =>
      entry.url.startsWith(`${CANONICAL_ORIGIN}/where-to-meet`)
    );
    expect(
      guideEntries.map((entry) => [entry.url.slice(CANONICAL_ORIGIN.length), entry.lastModified])
    ).toEqual([
      ['/where-to-meet', '2026-10-05'],
      ['/where-to-meet/new-york', '2026-10-05'],
      ['/where-to-meet/new-york/team-meeting', '2026-10-05'],
      ['/where-to-meet/new-york/coffee-catch-up', '2026-10-03'],
      ['/where-to-meet/new-york/williamsburg', '2026-10-04'],
      ['/where-to-meet/new-york/williamsburg/date-night', '2026-10-04'],
      ['/where-to-meet/new-york/williamsburg/weekend-hangout', '2026-10-02'],
      ['/where-to-meet/ann-arbor', '2026-10-05'],
      ['/where-to-meet/ann-arbor/group-dinner', '2026-10-05'],
      ['/where-to-meet/ann-arbor/coffee-catch-up', '2026-10-01'],
      ['/where-to-meet/ann-arbor/kerrytown', '2026-10-03'],
      ['/where-to-meet/ann-arbor/kerrytown/weekend-hangout', '2026-10-03'],
    ]);
  });

  it('uses fixed ISO content dates for lastModified, never the build time', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    const entries = await sitemap();
    for (const entry of entries) {
      expect(typeof entry.lastModified).toBe('string');
      expect(entry.lastModified).toMatch(ISO_DATE);
    }
    expect(await sitemap()).toEqual(entries);
  });

  it('never exposes meeting, dashboard or auth pages', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
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

  it('describes a blog post as a BlogPosting by the Where2Meet team', () => {
    const post = getPost('how-to-choose-a-team-meeting-location')!;
    expect(
      generateBlogPostingSchema({
        ...post,
        path: postPath(post.slug),
        coverPath: coverPath(post.slug),
      })
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'How to choose a team meeting location',
      description:
        'Your team is spread across town. Compare travel times, pick a venue that suits the meeting, and settle on a place without a week of back-and-forth.',
      image: `${CANONICAL_ORIGIN}/blog/how-to-choose-a-team-meeting-location/cover.png`,
      datePublished: '2026-10-04',
      dateModified: '2026-10-08',
      author: { '@type': 'Organization', name: 'The Where2Meet team', url: CANONICAL_ORIGIN },
      publisher: { '@id': `${CANONICAL_ORIGIN}/#organization` },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${CANONICAL_ORIGIN}/blog/how-to-choose-a-team-meeting-location`,
      },
    });
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

  it('only links to live pages on the www host', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    const links = linksIn(await llmsTxt());
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect([
        ...pageUrls,
        ...BLOG_URLS,
        ...FIXTURE_GUIDE_URLS,
        `${CANONICAL_ORIGIN}/sitemap.xml`,
      ]).toContain(link);
    }
  });

  it('links the blog and every post', async () => {
    expect(linksIn(await llmsTxt())).toEqual(expect.arrayContaining(BLOG_URLS));
  });

  it('keeps control plane copy on one list line with its link intact', () => {
    const seo = { title: 'Where to meet [beta]', description: 'Two lines\nof copy.' };
    const { catalog } = parsePublished({
      version: 1,
      cities: [{ slug: 'testville', name: 'Testville', updated_at: '2026-10-05', seo }],
    });
    expect(buildLlmsTxt(catalog)).toContain(
      `- [Where to meet \\[beta\\]](${CANONICAL_ORIGIN}/where-to-meet/testville): Two lines of copy.\n`
    );
  });

  it('lists every published guide between the pages and the sitemap', async () => {
    const withoutGuides = await llmsTxt();
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    const withGuides = await llmsTxt();

    expect(withoutGuides).not.toContain('## Local guides');
    const [pages, optional] = withoutGuides.split('\n## Optional\n');
    const [before, guides] = withGuides.split('\n## Local guides\n');
    expect(before).toBe(pages);
    expect(guides.endsWith(`\n## Optional\n${optional}`)).toBe(true);
    expect(linksIn(guides).slice(0, -1)).toEqual(FIXTURE_GUIDE_URLS);
  });
});

describe('positioning copy', () => {
  it('never calls the spot fair or says "meet in the middle"', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    for (const text of [
      SITE_CONFIG.defaultTitle,
      SITE_CONFIG.description,
      SITE_CONFIG.tagline,
      SITE_CONFIG.pitch,
      await llmsTxt(),
      ...BLOG_POSTS.flatMap((post) => [post.title, post.description, readPostBody(post.slug)]),
      ...strings(fixture),
    ]) {
      expect(text).not.toMatch(/\bfair/i);
      expect(text).not.toMatch(/meet in the middle/i);
    }
  });
});
