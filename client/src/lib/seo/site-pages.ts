import { assertIsoDate } from './types/content';

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

const pages: StaticPageEntry[] = [
  { path: '/', lastModified: '2026-09-04', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/how-it-works', lastModified: '2025-12-31', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', lastModified: '2026-09-04', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/scenarios', lastModified: '2025-12-31', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', lastModified: '2025-12-30', changeFrequency: 'yearly', priority: 0.5 },
];

/**
 * Static marketing pages that belong in the sitemap.
 *
 * Scenario guides are NOT listed here; they are generated from the scenario
 * content registry so a new scenario is never missing from the sitemap.
 *
 * Meeting pages (/meet/[id]) are intentionally excluded because they are
 * user-generated, noindex, and would expose private event IDs.
 */
export const STATIC_PAGES: readonly StaticPageEntry[] = pages.map((entry) => ({
  ...entry,
  lastModified: assertIsoDate(entry.lastModified, `STATIC_PAGES[${entry.path}].lastModified`),
}));
