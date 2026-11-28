import type { MetadataRoute } from 'next';
import {
  BLOG_PATH,
  latestUpdate,
  listPages,
  pagePath,
  pagePhotos,
  pageUpdatedAt,
  type Catalog,
} from '@/features/blog/lib/catalog';
import { loadCatalog } from '@/features/blog/lib/source';
import { loadLiveThemes } from '@/features/nyc-map/lib/source';
import { NYC_PATH, themePath } from '@/features/nyc-map/model/themes';
import { homeCities } from '@/features/landing/lib/home-cities';
import { toAbsoluteUrl } from '@/lib/seo/metadata';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { STATIC_PAGES } from '@/lib/seo/site-pages';

/**
 * Generate sitemap for Where2Meet
 *
 * - URLs use the canonical `www` host from SITE_CONFIG.
 * - `lastModified` values are real content dates (see `src/lib/seo/site-pages.ts`, `homeUpdatedAt`,
 *   each post's `updated_at`, and `pageUpdatedAt` for a city or town), never the build time.
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, themes] = await Promise.all([loadCatalog(), loadLiveThemes()]);
  return [
    ...STATIC_PAGES.map((page) => ({
      url: page.path === '/' ? SITE_CONFIG.url : `${SITE_CONFIG.url}${page.path}`,
      lastModified:
        page.path === '/' ? homeUpdatedAt(catalog, page.lastModified) : page.lastModified,
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
      lastModified: pageUpdatedAt(catalog, page),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      images: pagePhotos(page).map((photo) => toAbsoluteUrl(photo.src)),
    })),
    ...(themes.length > 0
      ? [
          {
            url: `${SITE_CONFIG.url}${NYC_PATH}`,
            lastModified: themes
              .map((theme) => theme.updatedAt)
              .sort()
              .at(-1)!,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          },
        ]
      : []),
    ...themes.map((theme) => ({
      url: `${SITE_CONFIG.url}${themePath(theme)}`,
      lastModified: theme.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}

/** The home page changes when it starts linking a city, which is when the city gets its first guide. */
function homeUpdatedAt(catalog: Catalog, ownDate: string): string {
  return [ownDate, ...homeCities(catalog).map(({ linkedSince }) => linkedSince)].sort().at(-1)!;
}
