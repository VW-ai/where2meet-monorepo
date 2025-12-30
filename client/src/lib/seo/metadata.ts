import type { Metadata } from 'next';

/**
 * Core site configuration with differentiated positioning
 * Focus: Fair Meeting Planning + Travel Time Comparison + Visual Analysis
 */
export const SITE_CONFIG = {
  name: 'Where2Meet',
  url: 'https://where2meet.org',
  author: 'Where2Meet Team',
  locale: 'en_US',
  themeColor: '#3b82f6',

  // Differentiated positioning - emphasizes fairness and travel time comparison
  defaultTitle: 'Where2Meet – Fair Meeting Planner with Travel Time Comparison',
  description:
    "Find fair meeting spots with equal travel time for everyone. Compare commute distances, visualize optimal locations, and plan meetings that respect everyone's time. AI-powered meeting location finder.",

  // Strategic keywords organized by category
  keywords: {
    // Core generic keywords
    core: [
      'meeting spot finder',
      'central meeting point',
      'group meeting planner',
      'meetup location',
    ],

    // Differentiation keywords - what makes Where2Meet unique
    differentiation: [
      'fair meeting planner',
      'travel time comparison',
      'equal commute meeting',
      'fair travel distance',
      'equidistant meeting point',
      'commute fairness',
    ],

    // AI/Smart features
    ai: ['AI meeting planner', 'smart meeting location', 'intelligent venue finder'],

    // Feature-specific
    features: [
      'visual map meeting planner',
      'multi-location midpoint',
      'travel time visualization',
      'meeting cost calculator',
    ],
  },

  // Flattened keywords array for metadata
  get allKeywords(): string[] {
    return [
      ...this.keywords.core,
      ...this.keywords.differentiation,
      ...this.keywords.ai,
      ...this.keywords.features,
    ];
  },
} as const;

/**
 * Options for creating page metadata
 */
export interface MetadataOptions {
  /** Page title (will be templated with site name) */
  title?: string;

  /** Page description */
  description?: string;

  /**
   * Canonical URL - can be:
   * - Relative path: '/about' -> 'https://where2meet.org/about'
   * - Absolute URL: 'https://where2meet.org/about'
   */
  canonical?: string;

  /**
   * OpenGraph image - can be:
   * - Relative path: '/og-image.png'
   * - Absolute URL: 'https://where2meet.org/og-image.png'
   */
  image?: string;

  /** Alt text for OG image */
  imageAlt?: string;

  /** OpenGraph type (default: 'website') */
  ogType?: 'website' | 'article';

  /**
   * Custom keywords (will be merged with default keywords)
   * Use this to add page-specific keywords
   */
  keywords?: string[];

  /**
   * Keywords category to emphasize for this page
   * 'core' - Generic meeting planner keywords
   * 'differentiation' - Fair travel time keywords
   * 'ai' - AI-powered keywords
   * 'features' - Feature-specific keywords
   */
  keywordsFocus?: keyof typeof SITE_CONFIG.keywords;

  /**
   * Robots configuration
   * 'index' - Allow indexing (default for public pages)
   * 'noindex' - Prevent indexing (for meeting pages, user-generated content)
   */
  robots?: {
    index: boolean;
    follow: boolean;
  };

  /**
   * Article metadata (only if ogType is 'article')
   */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
    tags?: string[];
  };

  /**
   * Language alternates for i18n
   * Example: { 'en': '/about', 'zh': '/zh/about' }
   */
  languages?: Record<string, string>;
}

/**
 * Generate absolute URL from relative path or return URL if already absolute
 */
function toAbsoluteUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  return new URL(urlOrPath, SITE_CONFIG.url).toString();
}

/**
 * Get prioritized keywords based on focus area
 */
function getPrioritizedKeywords(
  focus?: keyof typeof SITE_CONFIG.keywords,
  customKeywords?: string[]
): string[] {
  const keywords: string[] = [];

  // Add focus keywords first (most important for this page)
  if (focus) {
    keywords.push(...SITE_CONFIG.keywords[focus]);
  }

  // Add differentiation keywords (always important)
  if (focus !== 'differentiation') {
    keywords.push(...SITE_CONFIG.keywords.differentiation);
  }

  // Add core keywords
  if (focus !== 'core') {
    keywords.push(...SITE_CONFIG.keywords.core);
  }

  // Add AI keywords
  if (focus !== 'ai') {
    keywords.push(...SITE_CONFIG.keywords.ai);
  }

  // Add custom keywords
  if (customKeywords && customKeywords.length > 0) {
    keywords.push(...customKeywords);
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(keywords));
}

/**
 * Create metadata for a page with SEO best practices
 *
 * Features:
 * - Differentiated positioning (fair travel time comparison)
 * - Absolute URLs for OG/Twitter images
 * - Flexible canonical URL handling
 * - Strategic keyword prioritization
 * - Proper robots configuration
 * - i18n-ready with language alternates
 *
 * @param options - Metadata configuration options
 * @returns Next.js Metadata object
 */
export function createMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title,
    description = SITE_CONFIG.description,
    canonical,
    image = '/og-image.png',
    imageAlt = 'Where2Meet - Fair Meeting Planner with Travel Time Comparison',
    ogType = 'website',
    keywords: customKeywords,
    keywordsFocus,
    robots,
    article,
    languages,
  } = options;

  // Generate absolute image URL
  const absoluteImageUrl = toAbsoluteUrl(image);

  // Construct full title
  const fullTitle = title
    ? `${title} | ${SITE_CONFIG.name} – Fair Meeting Planner`
    : SITE_CONFIG.defaultTitle;

  // Build metadata object
  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: getPrioritizedKeywords(keywordsFocus, customKeywords),

    // OpenGraph
    openGraph: {
      type: ogType,
      locale: SITE_CONFIG.locale,
      siteName: SITE_CONFIG.name,
      title: fullTitle,
      description,
      images: [
        {
          url: absoluteImageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },

    // Twitter
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [absoluteImageUrl],
    },
  };

  // Add canonical URL if provided
  if (canonical) {
    const canonicalUrl = toAbsoluteUrl(canonical);
    metadata.alternates = {
      canonical: canonicalUrl,
    };
  }

  // Add language alternates if provided (for future i18n)
  if (languages && Object.keys(languages).length > 0) {
    if (!metadata.alternates) {
      metadata.alternates = {};
    }
    metadata.alternates.languages = Object.fromEntries(
      Object.entries(languages).map(([lang, path]) => [lang, toAbsoluteUrl(path)])
    );
  }

  // Configure robots
  if (robots !== undefined) {
    metadata.robots = {
      index: robots.index,
      follow: robots.follow,
      // GoogleBot-specific settings for better control
      googleBot: {
        index: robots.index,
        follow: robots.follow,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    };
  }

  // Add article metadata if applicable
  if (ogType === 'article' && article) {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: article.publishedTime,
      modifiedTime: article.modifiedTime,
      authors: article.authors,
      tags: article.tags,
    };
  }

  return metadata;
}

/**
 * Metadata preset for meeting pages (user-generated content)
 *
 * Meeting pages should:
 * - NOT be indexed (noindex) to avoid duplicate/spam content
 * - Allow following links (follow) for OG crawling and internal link equity
 * - Have dynamic OG metadata for sharing
 *
 * Note: OG crawlers (Facebook, Twitter) do NOT rely on robots follow directive.
 * They fetch the page directly. We use follow:true for general link equity.
 */
export function createMeetingPageMetadata(options: {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
}): Metadata {
  return createMetadata({
    ...options,
    robots: {
      index: false, // Don't index user-generated meeting pages
      follow: true, // Allow link following for internal equity
    },
    keywordsFocus: 'differentiation', // Emphasize fair travel time
  });
}

/**
 * Metadata preset for blog/article pages
 */
export function createArticleMetadata(options: {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  publishedTime: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}): Metadata {
  return createMetadata({
    title: options.title,
    description: options.description,
    canonical: options.canonical,
    image: options.image,
    ogType: 'article',
    robots: {
      index: true,
      follow: true,
    },
    article: {
      publishedTime: options.publishedTime,
      modifiedTime: options.modifiedTime,
      authors: options.authors,
      tags: options.tags,
    },
    keywordsFocus: 'core', // Blog posts usually target core keywords
  });
}

/**
 * Metadata preset for feature/landing pages
 */
export function createFeaturePageMetadata(options: {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  return createMetadata({
    ...options,
    robots: {
      index: true,
      follow: true,
    },
    keywordsFocus: 'features', // Feature pages highlight specific capabilities
  });
}
