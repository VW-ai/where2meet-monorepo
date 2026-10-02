import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { STATIC_PAGES } from '@/lib/seo/site-pages';

/**
 * Generate sitemap for Where2Meet
 *
 * - URLs use the canonical `www` host from SITE_CONFIG.
 * - `lastModified` values are real, hand-maintained content dates
 *   (see `src/lib/seo/site-pages.ts`), never the build time.
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PAGES.map((page) => ({
    url: page.path === '/' ? SITE_CONFIG.url : `${SITE_CONFIG.url}${page.path}`,
    lastModified: page.lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
