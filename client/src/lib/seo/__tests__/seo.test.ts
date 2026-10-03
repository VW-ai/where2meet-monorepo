import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SITE_CONFIG,
  buildPageTitle,
  createMeetingPageMetadata,
  createMetadata,
  toAbsoluteUrl,
} from '@/lib/seo/metadata';
import {
  generateOrganizationSchema,
  generateWebApplicationSchema,
} from '@/lib/seo/structured-data';
import { STATIC_PAGES } from '@/lib/seo/site-pages';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import nextConfig from '../../../../next.config.js';

const CANONICAL_ORIGIN = 'https://www.where2meet.org';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LLMS_TXT = readFileSync(path.join(__dirname, '../../../../public/llms.txt'), 'utf8');

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

  it('marks meeting pages noindex but follow', () => {
    const metadata = asJson<{ robots: { index: boolean; follow: boolean } }>(
      createMeetingPageMetadata({ title: 'Team lunch', description: 'Vote on a spot' })
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});

describe('sitemap', () => {
  const entries = sitemap();

  it('lists every public page exactly once', () => {
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual([
      CANONICAL_ORIGIN,
      `${CANONICAL_ORIGIN}/faq`,
      `${CANONICAL_ORIGIN}/contact`,
    ]);
  });

  it('uses fixed ISO content dates for lastModified, never the build time', () => {
    for (const entry of entries) {
      expect(typeof entry.lastModified).toBe('string');
      expect(entry.lastModified).toMatch(ISO_DATE);
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
    for (const source of ['/how-it-works', '/scenarios', '/scenarios/:slug']) {
      expect(redirects).toContainEqual({ source, destination: '/', permanent: true });
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
  const links = [...LLMS_TXT.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);

  it('only links to live pages on the www host', () => {
    const pageUrls = STATIC_PAGES.map((page) =>
      page.path === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${page.path}`
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect([...pageUrls, `${CANONICAL_ORIGIN}/sitemap.xml`]).toContain(link);
    }
  });
});

describe('positioning copy', () => {
  it('never calls the spot fair or says "meet in the middle"', () => {
    for (const text of [
      SITE_CONFIG.defaultTitle,
      SITE_CONFIG.description,
      SITE_CONFIG.tagline,
      SITE_CONFIG.pitch,
      LLMS_TXT,
    ]) {
      expect(text).not.toMatch(/\bfair/i);
      expect(text).not.toMatch(/meet in the middle/i);
    }
  });
});
