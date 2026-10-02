import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo/metadata';

/**
 * Paths no crawler should fetch: private app surfaces, the API, and the
 * localStorage debugging pages that are still shipped in /public.
 *
 * Meeting pages (/meet/[id]) are deliberately NOT listed: they carry a
 * `noindex` meta tag, and crawlers can only honour it if they are allowed to
 * fetch the page.
 */
const DISALLOWED_PATHS = [
  '/dashboard',
  '/auth/',
  '/api/',
  '/debug-claim-tokens.html',
  '/clear-invalid-tokens.html',
];

/**
 * AI search / answer-engine retrieval bots.
 *
 * Stance: default-open. These bots fetch pages to cite them in answers
 * (ChatGPT search, Claude, Perplexity), which is where a young brand with a
 * When2Meet name collision needs to be visible. Listing them explicitly
 * documents the decision and makes it easy to tighten later.
 */
const AI_RETRIEVAL_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
      ...AI_RETRIEVAL_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
