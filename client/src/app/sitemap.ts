import type { MetadataRoute } from 'next';

/**
 * Generate sitemap for Where2Meet
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 *
 * Future: If "Public Events" feature is added, create a separate
 * sitemap-events.xml for public events only
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://where2meet.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
