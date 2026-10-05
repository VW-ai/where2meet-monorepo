import type { MetadataRoute } from 'next';
import { BLOG_POSTS, postPath } from '@/content/blog/posts';
import {
  GUIDES_PATH,
  latestUpdate,
  listPages,
  pageEntry,
  pagePath,
} from '@/features/guides/lib/catalog';
import { loadCatalog } from '@/features/guides/lib/source';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { STATIC_PAGES } from '@/lib/seo/site-pages';

/**
 * Generate sitemap for Where2Meet
 *
 * - URLs use the canonical `www` host from SITE_CONFIG.
 * - `lastModified` values are real content dates (see `src/lib/seo/site-pages.ts`,
 *   `src/content/blog/posts.ts` and the control plane's `updated_at`), never the build time.
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadCatalog();
  const guidesUpdated = latestUpdate(catalog);
  return [
    ...STATIC_PAGES.map((page) => ({
      url: page.path === '/' ? SITE_CONFIG.url : `${SITE_CONFIG.url}${page.path}`,
      lastModified: page.lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    {
      url: `${SITE_CONFIG.url}/blog`,
      lastModified: BLOG_POSTS.map((post) => post.updatedAt)
        .sort()
        .at(-1),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE_CONFIG.url}${postPath(post.slug)}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // The guides index is listed only once a guide is published; until then it's empty.
    ...(guidesUpdated
      ? [
          {
            url: `${SITE_CONFIG.url}${GUIDES_PATH}`,
            lastModified: guidesUpdated,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          },
        ]
      : []),
    ...listPages(catalog).map((page) => ({
      url: `${SITE_CONFIG.url}${pagePath(page)}`,
      lastModified: pageEntry(page).updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
