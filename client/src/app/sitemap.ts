import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { STATIC_PAGES } from '@/lib/seo/site-pages';
import { getAllScenarioSlugs, getScenario } from '@/app/(landing)/scenarios/data/scenarios';

/**
 * Generate sitemap for Where2Meet
 *
 * - URLs use the canonical `www` host from SITE_CONFIG.
 * - `lastModified` values are real, hand-maintained content dates
 *   (see `src/lib/seo/site-pages.ts` and the scenario registry), never the
 *   build time.
 * - Scenario pages are derived from the content registry so the sitemap can
 *   not drift out of sync with the published guides.
 *
 * Note: Dynamic meeting pages (/meet/[id]) are intentionally excluded because:
 * - They are user-generated and mostly private/temporary
 * - They have noindex robots directive
 * - Including them could expose private event IDs
 * - They are discovered through shared links instead
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: page.path === '/' ? SITE_CONFIG.url : `${SITE_CONFIG.url}${page.path}`,
    lastModified: page.lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const scenarioEntries: MetadataRoute.Sitemap = getAllScenarioSlugs().flatMap((slug) => {
    const scenario = getScenario(slug);
    if (!scenario) return [];
    return [
      {
        url: `${SITE_CONFIG.url}/scenarios/${slug}`,
        lastModified: scenario.contentMetadata.lastModified,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      },
    ];
  });

  return [...staticEntries, ...scenarioEntries];
}
