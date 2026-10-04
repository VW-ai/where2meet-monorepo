export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface StaticPageEntry {
  /** Path relative to the site root ('/' for the home page) */
  path: string;
  /**
   * ISO 8601 date (YYYY-MM-DD) of the last CONTENT change to the page.
   * Hand-maintained on purpose: a build-time `new Date()` would tell search
   * engines every page changed on every deploy, which they learn to ignore.
   */
  lastModified: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Fails at module load so a typo breaks the build instead of shipping a bad lastmod. */
export function assertIsoDate<T extends string>(value: T, label: string): T {
  if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date (YYYY-MM-DD), received "${value}"`);
  }
  return value;
}

// Update `lastModified` when a page's content changes.
const pages: StaticPageEntry[] = [
  { path: '/', lastModified: '2026-10-04', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/faq', lastModified: '2026-10-02', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', lastModified: '2026-09-29', changeFrequency: 'yearly', priority: 0.5 },
];

/**
 * Public marketing pages that belong in the sitemap.
 *
 * Meeting pages (/meet/[id]) are intentionally excluded because they are
 * user-generated, noindex, and would expose private event IDs.
 */
export const STATIC_PAGES: readonly StaticPageEntry[] = pages.map((entry) => ({
  ...entry,
  lastModified: assertIsoDate(entry.lastModified, `STATIC_PAGES[${entry.path}].lastModified`),
}));
