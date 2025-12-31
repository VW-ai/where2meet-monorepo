/**
 * Content Metadata Registry
 *
 * Central registry for tracking content freshness across all pages.
 * Used by content audit scripts to identify stale content.
 */

import type { ContentMetadata } from './types/content';
import { createContentMetadata } from './types/content';

/**
 * Registry of all content pages with their metadata
 */
export const CONTENT_REGISTRY: Record<string, ContentMetadata> = {
  // Homepage
  '/': createContentMetadata('landing', 'monthly'),

  // Feature pages
  '/how-it-works': createContentMetadata('feature', 'quarterly'),
  '/faq': createContentMetadata('faq', 'monthly'),
  '/contact': createContentMetadata('landing', 'yearly'),

  // Scenario pages will be added here as they're created
  // Example:
  // '/scenarios/friends-group-dinner-spot': createContentMetadata('scenario', 'quarterly'),
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
