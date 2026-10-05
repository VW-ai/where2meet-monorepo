import type {
  BlogPosting,
  BreadcrumbList,
  Event,
  FAQPage,
  Organization,
  WebApplication,
  WebSite,
  WithContext,
} from 'schema-dts';
import { BLOG_AUTHOR } from '@/content/blog/posts';
import { SITE_CONFIG, toAbsoluteUrl } from './metadata';

/**
 * Generate Organization schema for root layout
 * Represents the Where2Meet organization/brand
 */
export function generateOrganizationSchema(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_CONFIG.url}/#organization`,
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SITE_CONFIG.description,
    foundingDate: '2025',
    // Add social media profiles when available
    // sameAs: [
    //   'https://twitter.com/where2meet',
    //   'https://github.com/where2meet',
    // ],
  };
}

/**
 * Generate WebSite schema for landing page
 * Represents the Where2Meet website with search capability
 */
export function generateWebSiteSchema(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_CONFIG.url}/#website`,
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    publisher: { '@id': `${SITE_CONFIG.url}/#organization` },
    // Uncomment when search feature is implemented
    // potentialAction: {
    //   '@type': 'SearchAction',
    //   target: {
    //     '@type': 'EntryPoint',
    //     urlTemplate: `${SITE_CONFIG.url}/search?q={search_term_string}`,
    //   },
    //   'query-input': 'required name=search_term_string',
    // },
  };
}

/**
 * Generate WebApplication schema for the landing page
 *
 * Tells search engines and AI crawlers what the product IS (a free web app
 * for planning where to meet), which the Organization/WebSite
 * schemas alone do not convey.
 *
 * No `aggregateRating` is included on purpose: we have no verified reviews,
 * and fabricated ratings violate Google's structured data policies.
 */
export function generateWebApplicationSchema(): WithContext<WebApplication> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_CONFIG.url}/#webapplication`,
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Compare real travel times for every participant',
      'Find meeting spots with balanced commutes instead of a geographic midpoint',
      'Visualize participant locations and routes on a map',
      'Vote on candidate venues as a group',
      'No account required to create a meeting',
    ],
    publisher: { '@id': `${SITE_CONFIG.url}/#organization` },
  };
}

/**
 * Event data for generating Event schema
 * ⚠️ CONSERVATIVE USE ONLY
 */
export interface EventData {
  name: string;
  startDate: string | Date;
  endDate?: string | Date;
  location?: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  organizer?: {
    name: string;
    url?: string;
  };
}

/**
 * Generate Event schema for meeting pages
 *
 * ⚠️ IMPORTANT: Use this VERY conservatively!
 * - Only for public, ticketed events with confirmed venue addresses
 * - OR only use minimal safe fields: name, startDate, organizer
 * - Rich Results are a bonus, not critical for SEO success
 * - Focus on Open Graph and h1 tags for meeting pages instead
 *
 * @param data - Event data (use minimal fields)
 * @returns Event schema with minimal fields
 */
export function generateEventSchema(data: EventData): WithContext<Event> {
  const schema: WithContext<Event> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.name,
    startDate: typeof data.startDate === 'string' ? data.startDate : data.startDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: {
      '@type': 'Organization',
      name: data.organizer?.name || SITE_CONFIG.name,
      url: data.organizer?.url || SITE_CONFIG.url,
    },
  };

  // Only add endDate if provided
  if (data.endDate) {
    schema.endDate = typeof data.endDate === 'string' ? data.endDate : data.endDate.toISOString();
  }

  // Only add location if we have a confirmed venue
  // ⚠️ Don't add location unless you have a real, confirmed venue address
  if (data.location && data.location.address) {
    schema.location = {
      '@type': 'Place',
      name: data.location.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: data.location.address,
      },
    };

    // Add geo coordinates if available
    if (data.location.latitude && data.location.longitude) {
      schema.location.geo = {
        '@type': 'GeoCoordinates',
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      };
    }
  }

  return schema;
}

/**
 * FAQ item for generating FAQ schema
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Generate FAQPage schema for FAQ pages
 *
 * Best practices:
 * - Only include questions that are actually visible on the page
 * - Keep answers factual and concise (avoid marketing language)
 * - Use plain text (HTML will be stripped by search engines)
 * - Minimum 2 questions recommended
 *
 * @param faqs - Array of FAQ items (question + answer pairs)
 * @returns FAQPage schema
 */
export function generateFAQSchema(faqs: FAQItem[]): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/** A blog post or a local guide, by the Where2Meet team. Paths are site-relative. */
export interface Article {
  title: string;
  description: string;
  path: string;
  coverPath: string;
  publishedAt: string;
  updatedAt: string;
}

export function generateBlogPostingSchema(article: Article): WithContext<BlogPosting> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: toAbsoluteUrl(article.coverPath),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Organization', name: BLOG_AUTHOR, url: SITE_CONFIG.url },
    publisher: { '@id': `${SITE_CONFIG.url}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': toAbsoluteUrl(article.path) },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}
