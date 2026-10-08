import { MapPin } from 'lucide';
import { renderArticleCover } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { GUIDES_PATH, pageArea, pageEntry, type GuidesPage } from './catalog';
import { occasionIcon } from './occasion-icon';
import { loadPage } from './source';

/** "Midtown · Team meeting" on a guide, "Midtown, New York" on a town hub. */
function coverBadge(page: GuidesPage): string {
  if (page.kind === 'guide') return `${pageArea(page).name} · ${page.guide.occasion.label}`;
  const { city, town } = page;
  return town ? `${town.name}, ${city.name}` : [city.name, city.region].filter(Boolean).join(', ');
}

/** A page's 1200x630 cover, or a 404 when nothing is published there. */
export async function coverResponse(segments: readonly string[]): Promise<Response> {
  const page = await loadPage(segments);
  if (!page) return new Response('Not found', { status: 404 });
  return renderArticleCover({
    icon: page.kind === 'guide' ? occasionIcon(page.guide.occasion.key) : MapPin,
    badge: coverBadge(page),
    title: pageEntry(page).seo.title,
    address: `${new URL(SITE_CONFIG.url).host}${GUIDES_PATH}`,
  });
}
