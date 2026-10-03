import type { Metadata } from 'next';

/**
 * Core site configuration with differentiated positioning
 * Focus: Planning Where to Meet Together + Travel Time Comparison + Visual Analysis
 *
 * `url` is the canonical origin. Production serves the site from the `www`
 * host (the apex redirects there), so every absolute URL we emit (canonical,
 * Open Graph, sitemap, robots, JSON-LD) must use the `www` host to avoid
 * canonical/redirect mismatches.
 */
export const SITE_CONFIG = {
  name: 'Where2Meet',
  url: 'https://www.where2meet.org',
  author: 'Where2Meet Team',
  locale: 'en_US',
  themeColor: '#3b82f6',

  // Differentiated positioning - emphasizes planning together and travel time comparison
  defaultTitle: 'Where2Meet – Plan Where to Meet With Your Group',
  description:
    'Plan where to meet with your group. Everyone adds where they are coming from, you compare travel times on a map, then vote on a convenient spot. No sign-up.',
  tagline: 'Plan where to meet, together',
  pitch: "Share a link, compare everyone's travel time, and vote on a convenient spot.",
} as const;

/**
 * Options for creating page metadata
 */
export interface MetadataOptions {
  /** Page title (site name is appended as a suffix) */
  title?: string;

  /** Page description */
  description?: string;

  /**
   * Canonical URL - can be:
   * - Relative path: '/about' -> 'https://www.where2meet.org/about'
   * - Absolute URL: 'https://www.where2meet.org/about'
   */
  canonical?: string;

  /**
   * OpenGraph image - can be:
   * - Relative path: '/og-image.png'
   * - Absolute URL: 'https://www.where2meet.org/og-image.png'
   */
  image?: string;

  /** Alt text for OG image */
  imageAlt?: string;

  /** OpenGraph type (default: 'website') */
  ogType?: 'website' | 'article';

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
export function toAbsoluteUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  return new URL(urlOrPath, SITE_CONFIG.url).toString();
}

/**
 * Build the full <title> for a page.
 *
 * The suffix is added here and ONLY here. The root layout intentionally does
 * not define a `title.template`, otherwise the suffix would be applied twice
 * ("Page | Where2Meet | Where2Meet ...").
 */
export function buildPageTitle(title?: string): string {
  return title ? `${title} | ${SITE_CONFIG.name}` : SITE_CONFIG.defaultTitle;
}

/**
 * Create metadata for a page with SEO best practices
 *
 * Features:
 * - Differentiated positioning (planning together with travel time comparison)
 * - Absolute URLs for OG/Twitter images
 * - Flexible canonical URL handling
 * - Proper robots configuration
 * - i18n-ready with language alternates
 *
 * Note: no `keywords` meta tag is emitted. Search engines ignore it and it
 * only leaks targeting intent.
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
    imageAlt = 'Where2Meet – plan where to meet with your group',
    ogType = 'website',
    robots,
    article,
    languages,
  } = options;

  // Generate absolute image URL
  const absoluteImageUrl = toAbsoluteUrl(image);

  // Construct full title
  const fullTitle = buildPageTitle(title);

  // Build metadata object
  const metadata: Metadata = {
    title: fullTitle,
    description,

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
    metadata.openGraph = {
      ...metadata.openGraph,
      url: canonicalUrl,
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
}): Metadata {
  return createMetadata({
    ...options,
    robots: {
      index: true,
      follow: true,
    },
  });
}
