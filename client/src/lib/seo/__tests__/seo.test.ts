import { describe, expect, it } from 'vitest';
import {
  SITE_CONFIG,
  buildPageTitle,
  createArticleMetadata,
  createMeetingPageMetadata,
  createMetadata,
  toAbsoluteUrl,
} from '@/lib/seo/metadata';
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebApplicationSchema,
} from '@/lib/seo/structured-data';
import { createContentMetadata } from '@/lib/seo/types/content';
import { STATIC_PAGES } from '@/lib/seo/site-pages';
import { CONTENT_REGISTRY } from '@/lib/seo/content-registry';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { getAllScenarioSlugs, getScenario } from '@/app/(landing)/scenarios/data/scenarios';

const CANONICAL_ORIGIN = 'https://www.where2meet.org';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  it('emits canonical, Open Graph and Twitter URLs on the www host', () => {
    const metadata = asJson<{
      alternates: { canonical: string };
      openGraph: { url: string; images: Array<{ url: string; width: number; height: number }> };
      twitter: { images: string[] };
    }>(createMetadata({ title: 'FAQ', canonical: '/faq' }));

    expect(metadata.alternates.canonical).toBe(`${CANONICAL_ORIGIN}/faq`);
    expect(metadata.openGraph.url).toBe(`${CANONICAL_ORIGIN}/faq`);
    expect(metadata.openGraph.images[0]).toMatchObject({
      url: `${CANONICAL_ORIGIN}/og-image.png`,
      width: 1200,
      height: 630,
    });
    expect(metadata.twitter.images).toEqual([`${CANONICAL_ORIGIN}/og-image.png`]);
  });

  it('marks meeting pages noindex but follow', () => {
    const metadata = asJson<{ robots: { index: boolean; follow: boolean } }>(
      createMeetingPageMetadata({ title: 'Team lunch', description: 'Vote on a spot' })
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('emits article Open Graph fields for scenario guides', () => {
    const metadata = asJson<{
      openGraph: { type: string; publishedTime: string; modifiedTime: string };
      robots: { index: boolean };
    }>(
      createArticleMetadata({
        title: 'Guide',
        description: 'A guide',
        canonical: '/scenarios/guide',
        publishedTime: '2025-12-31',
        modifiedTime: '2026-01-15',
      })
    );
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2025-12-31',
      modifiedTime: '2026-01-15',
    });
    expect(metadata.robots.index).toBe(true);
  });
});

describe('sitemap', () => {
  const entries = sitemap();

  it('lists every static page and every scenario exactly once', () => {
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(STATIC_PAGES.length + getAllScenarioSlugs().length);
    expect(urls).toContain(CANONICAL_ORIGIN);
    for (const slug of getAllScenarioSlugs()) {
      expect(urls).toContain(`${CANONICAL_ORIGIN}/scenarios/${slug}`);
    }
  });

  it('uses the canonical www host for every URL', () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(CANONICAL_ORIGIN)).toBe(true);
    }
  });

  it('uses fixed ISO content dates for lastModified, never the build time', () => {
    for (const entry of entries) {
      expect(typeof entry.lastModified).toBe('string');
      expect(entry.lastModified).toMatch(ISO_DATE);
    }
    for (const slug of getAllScenarioSlugs()) {
      const entry = entries.find((item) => item.url === `${CANONICAL_ORIGIN}/scenarios/${slug}`);
      expect(entry?.lastModified).toBe(getScenario(slug)?.contentMetadata.lastModified);
    }
    expect(sitemap()).toEqual(entries);
  });

  it('never exposes meeting, dashboard or auth pages', () => {
    for (const entry of entries) {
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

  it('builds ordered breadcrumbs with absolute URLs', () => {
    const breadcrumbs = asJson<{
      itemListElement: Array<{ position: number; name: string; item: string }>;
    }>(
      generateBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Scenarios', url: '/scenarios' },
      ])
    );
    expect(breadcrumbs.itemListElement.map((item) => item.position)).toEqual([1, 2]);
    expect(breadcrumbs.itemListElement[0].item).toBe(`${CANONICAL_ORIGIN}/`);
    expect(breadcrumbs.itemListElement[1].item).toBe(`${CANONICAL_ORIGIN}/scenarios`);
  });

  it('describes a free web application without fabricated ratings', () => {
    const app = asJson<{ offers: { price: string }; aggregateRating?: unknown }>(
      generateWebApplicationSchema()
    );
    expect(app.offers.price).toBe('0');
    expect(app).not.toHaveProperty('aggregateRating');
  });

  it('defaults Article dateModified to datePublished and uses absolute URLs', () => {
    const article = asJson<{ url: string; datePublished: string; dateModified: string }>(
      generateArticleSchema({
        headline: 'Headline',
        description: 'Description',
        url: '/scenarios/example',
        datePublished: '2025-12-31',
      })
    );
    expect(article.url).toBe(`${CANONICAL_ORIGIN}/scenarios/example`);
    expect(article.dateModified).toBe('2025-12-31');
  });
});

describe('content dates', () => {
  it('rejects non-ISO dates', () => {
    expect(() => createContentMetadata('scenario', { publishedDate: '12/31/2025' })).toThrow();
  });

  it('rejects lastModified earlier than publishedDate', () => {
    expect(() =>
      createContentMetadata('scenario', { publishedDate: '2025-12-31', lastModified: '2025-12-01' })
    ).toThrow();
  });

  it('keeps explicit dates as given', () => {
    const metadata = createContentMetadata('scenario', {
      publishedDate: '2025-12-31',
      lastModified: '2026-01-15',
    });
    expect(metadata.publishedDate).toBe('2025-12-31');
    expect(metadata.lastModified).toBe('2026-01-15');
    expect(metadata.lastReviewed).toBe('2026-01-15');
    expect(metadata.nextReviewDate).toMatch(ISO_DATE);
  });

  it('keeps the page registry and the sitemap dates in sync', () => {
    for (const page of STATIC_PAGES) {
      expect(page.lastModified).toMatch(ISO_DATE);
      expect(CONTENT_REGISTRY[page.path]?.lastModified).toBe(page.lastModified);
    }
  });
});
