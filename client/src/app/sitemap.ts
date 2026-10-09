import type { MetadataRoute } from 'next';
import {
  BLOG_PATH,
  latestUpdate,
  listPages,
  pagePath,
  pagePhotos,
  pageUpdatedAt,
} from '@/features/blog/lib/catalog';
import { loadCatalog } from '@/features/blog/lib/source';
import { toAbsoluteUrl } from '@/lib/seo/metadata';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { STATIC_PAGES } from '@/lib/seo/site-pages';

/**
 * Generate sitemap for Where2Meet
 *
 * - URLs use the canonical `www` host from SITE_CONFIG.
 * - `lastModified` values are real content dates (see `src/lib/seo/site-pages.ts`,
 *   `src/content/blog/posts.ts` and the control plane's `updated_at`), never the build time.
 * - Every post, city and town lists the photos it shows, served from this site.
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadCatalog();
  return [
    ...STATIC_PAGES.map((page) => ({
      url: page.path === '/' ? SITE_CONFIG.url : `${SITE_CONFIG.url}${page.path}`,
      lastModified: page.lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    {
      url: `${SITE_CONFIG.url}${BLOG_PATH}`,
      lastModified: latestUpdate(catalog),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...listPages(catalog).map((page) => ({
      url: `${SITE_CONFIG.url}${pagePath(page)}`,
      lastModified: pageUpdatedAt(page),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      images: pagePhotos(page).map((photo) => toAbsoluteUrl(photo.src)),
    })),
  ];
}
