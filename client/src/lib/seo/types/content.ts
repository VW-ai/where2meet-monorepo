/**
 * Content Metadata Types for SEO Freshness Tracking
 *
 * Tracks when content was created, updated, reviewed to ensure freshness
 * and help maintain SEO relevance over time.
 */

export type ContentType = 'article' | 'landing' | 'feature' | 'faq' | 'scenario';

export type UpdateFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type ContentStatus = 'current' | 'needs_review' | 'stale';

/**
 * Content metadata for tracking freshness and update schedules
 */
export interface ContentMetadata {
  /** ISO 8601 date when content was first published */
  publishedDate: string;

  /** ISO 8601 date when content was last modified */
  lastModified: string;

  /** ISO 8601 date when content was last reviewed for accuracy */
  lastReviewed: string;

  /** ISO 8601 date when content should be reviewed next */
  nextReviewDate: string;

  /** Type of content for categorization */
  contentType: ContentType;

  /** How often content should be reviewed/updated */
  updateFrequency: UpdateFrequency;

  /** Current status of the content */
  status: ContentStatus;

  /** Optional: Who last updated the content */
  lastUpdatedBy?: string;

  /** Optional: Notes about what was changed */
  updateNotes?: string;
}

/**
 * Helper to calculate next review date based on update frequency
 */
export function calculateNextReviewDate(
  lastReviewDate: string,
  frequency: UpdateFrequency
): string {
  const date = new Date(lastReviewDate);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

/**
 * Helper to determine if content needs review
 */
export function needsReview(metadata: ContentMetadata): boolean {
  const today = new Date();
  const nextReview = new Date(metadata.nextReviewDate);
  return today >= nextReview;
}

/**
 * Helper to determine if content is stale (>6 months old without update)
 */
export function isStale(metadata: ContentMetadata): boolean {
  const lastModified = new Date(metadata.lastModified);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return lastModified < sixMonthsAgo;
}

/**
 * Helper to get content status
 */
export function getContentStatus(metadata: ContentMetadata): ContentStatus {
  if (isStale(metadata)) {
    return 'stale';
  }
  if (needsReview(metadata)) {
    return 'needs_review';
  }
  return 'current';
}

/**
 * Helper to create initial content metadata
 */
export function createContentMetadata(
  contentType: ContentType,
  frequency: UpdateFrequency = 'quarterly'
): ContentMetadata {
  const today = new Date().toISOString().split('T')[0];

  return {
    publishedDate: today,
    lastModified: today,
    lastReviewed: today,
    nextReviewDate: calculateNextReviewDate(today, frequency),
    contentType,
    updateFrequency: frequency,
    status: 'current',
  };
}

/**
 * Helper to update content metadata after a review/update
 */
export function updateContentMetadata(
  metadata: ContentMetadata,
  options: {
    modified?: boolean;
    reviewed?: boolean;
    updatedBy?: string;
    notes?: string;
  } = {}
): ContentMetadata {
  const today = new Date().toISOString().split('T')[0];
  const updated: ContentMetadata = { ...metadata };

  if (options.modified) {
    updated.lastModified = today;
  }

  if (options.reviewed) {
    updated.lastReviewed = today;
    updated.nextReviewDate = calculateNextReviewDate(today, metadata.updateFrequency);
  }

  if (options.updatedBy) {
    updated.lastUpdatedBy = options.updatedBy;
  }

  if (options.notes) {
    updated.updateNotes = options.notes;
  }

  updated.status = getContentStatus(updated);

  return updated;
}

/**
 * Update frequency recommendations by content type
 */
export const UPDATE_FREQUENCY_RECOMMENDATIONS: Record<ContentType, UpdateFrequency> = {
  landing: 'monthly', // Homepage - update frequently
  faq: 'monthly', // FAQ - add new questions regularly
  feature: 'quarterly', // Feature pages - update when features change
  article: 'quarterly', // Blog/article content - refresh periodically
  scenario: 'quarterly', // Scenario pages - update examples and tips
};
