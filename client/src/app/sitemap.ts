import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo/metadata';

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
  const currentDate = new Date();

  return [
    {
      url: SITE_CONFIG.url,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_CONFIG.url}/faq`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_CONFIG.url}/contact`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
