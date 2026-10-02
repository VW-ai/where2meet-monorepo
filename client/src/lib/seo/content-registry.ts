/**
 * Content Metadata Registry
 *
 * Central registry for tracking content freshness across all pages.
 * Used by content audit scripts to identify stale content.
 *
 * Dates are real, hand-maintained values (first commit / last content
 * change), NOT build-time timestamps. `lastModified` mirrors the sitemap
 * dates in `site-pages.ts`; keep the two in sync when content changes.
 */

import type { ContentMetadata } from './types/content';
import { createContentMetadata } from './types/content';

/**
 * Registry of all content pages with their metadata
 */
export const CONTENT_REGISTRY: Record<string, ContentMetadata> = {
  // Homepage
  '/': createContentMetadata(
    'landing',
    { publishedDate: '2025-11-22', lastModified: '2026-09-04' },
    'monthly'
  ),

  // Feature pages
  '/how-it-works': createContentMetadata(
    'feature',
    { publishedDate: '2025-12-30', lastModified: '2025-12-31' },
    'quarterly'
  ),
  '/faq': createContentMetadata(
    'faq',
    { publishedDate: '2025-12-30', lastModified: '2026-09-04' },
    'monthly'
  ),
  '/contact': createContentMetadata('landing', { publishedDate: '2025-12-30' }, 'yearly'),

  // Scenario hub (individual scenario guides track their own dates in the
  // scenario content registry: src/app/(landing)/scenarios/data/scenarios.ts)
  '/scenarios': createContentMetadata('landing', { publishedDate: '2025-12-31' }, 'monthly'),
};

/**
 * Get content metadata for a specific page
 */
export function getPageMetadata(path: string): ContentMetadata | undefined {
  return CONTENT_REGISTRY[path];
}

/**
 * Check if content metadata needs review
 */
export function needsReview(metadata: ContentMetadata): boolean {
  const today = new Date();
  const nextReview = new Date(metadata.nextReviewDate);
  return today >= nextReview;
}

/**
 * Get all pages that need review
 */
export function getPagesNeedingReview(): Array<{ path: string; metadata: ContentMetadata }> {
  return Object.entries(CONTENT_REGISTRY)
    .filter(([, metadata]) => needsReview(metadata))
    .map(([path, metadata]) => ({ path, metadata }));
}

/**
 * Check if content is stale (> 6 months without update)
 */
export function isStale(metadata: ContentMetadata): boolean {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const lastModified = new Date(metadata.lastModified);
  return lastModified < sixMonthsAgo;
}

/**
 * Get all stale pages (> 6 months without update)
 */
export function getStalePages(): Array<{ path: string; metadata: ContentMetadata }> {
  return Object.entries(CONTENT_REGISTRY)
    .filter(([, metadata]) => isStale(metadata))
    .map(([path, metadata]) => ({ path, metadata }));
}

/**
 * Update frequency recommendations by page type
 */
export const PAGE_UPDATE_SCHEDULE = {
  landing: 'Review monthly, update quarterly or when features change',
  feature: 'Review quarterly, update when product changes',
  faq: 'Review monthly, add new questions based on user feedback',
  scenario: 'Review quarterly, refresh examples seasonally',
  article: 'Review quarterly, update statistics and examples',
} as const;
