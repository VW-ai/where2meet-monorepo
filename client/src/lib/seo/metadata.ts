import type { Metadata } from 'next';

/**
 * Normalize URL to ensure it has a protocol
 * Handles cases where env var might be set without https://
 */
function normalizeUrl(url: string | undefined): string {
  if (!url) return 'https://where2meet.org';

  // If URL already has protocol, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Add https:// protocol if missing
  return `https://${url}`;
}

/**
 * Base site configuration for SEO
 */
export const SITE_CONFIG = {
  name: 'Where2Meet',
  url: normalizeUrl(process.env.NEXT_PUBLIC_APP_URL),
  description:
    'Find the perfect meeting spot for everyone. Compare travel times, visualize locations on a map, and discover ideal venues for your group meetings.',
  keywords: [
    'meeting spot finder',
    'group meeting planner',
    'find meeting location',
    'central meeting point calculator',
    'where to meet friends',
    'compare travel times',
    'fair meeting location',
    'visual meeting planning',
    'optimal meeting venue finder',
  ] as string[],
  author: 'Where2Meet',
  locale: 'en_US',
  themeColor: '#FF6B6B', // coral-500
};

/**
 * Options for creating metadata
 */
export interface MetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
  canonical?: string;
}

/**
 * Generate canonical URL from path
 */
export function generateCanonicalUrl(path: string): string {
  const baseUrl = SITE_CONFIG.url.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Create comprehensive metadata object with defaults
 */
export function createMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title,
    description = SITE_CONFIG.description,
    keywords = SITE_CONFIG.keywords,
    image = '/og-image.png',
    noIndex = false,
    canonical,
  } = options;

  const metadata: Metadata = {
    title,
    description,
    keywords,
    authors: [{ name: SITE_CONFIG.author }],
    creator: SITE_CONFIG.author,
    openGraph: {
      type: 'website',
      locale: SITE_CONFIG.locale,
      siteName: SITE_CONFIG.name,
      title: title || SITE_CONFIG.name,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SITE_CONFIG.name} - ${title || SITE_CONFIG.description}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title || SITE_CONFIG.name,
      description,
      images: [image],
    },
  };

  // Add canonical URL if provided
  if (canonical) {
    metadata.alternates = {
      canonical: generateCanonicalUrl(canonical),
    };
  }

  // Add robots configuration
  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  } else {
    metadata.robots = {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    };
  }

  return metadata;
}

/**
 * Create metadata for meeting pages with noindex but follow for OG crawling
 */
export function createMeetingMetadata(options: Omit<MetadataOptions, 'noIndex'>): Metadata {
  const metadata = createMetadata(options);

  // Override robots for meeting pages: noindex but allow follow for OG tags
  metadata.robots = {
    index: false, // Don't rank these pages
    follow: true, // Allow crawling for Open Graph
  };

  return metadata;
}
