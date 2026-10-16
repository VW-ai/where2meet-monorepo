import 'server-only';
import { MapPin } from 'lucide';
import { renderArticleCover, type CardPhoto } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { BLOG_PATH, pageCover, type BlogPage } from './catalog';
import { occasionIcon } from './occasion-icon';
import { readPhotoFile } from './photo-files';
import { coverCredit } from './photos';
import { loadPage } from './source';

export async function coverResponse(segments: readonly string[]): Promise<Response> {
  const page = await loadPage(segments);
  if (!page) return new Response('Not found', { status: 404 });
  return renderArticleCover({
    icon: page.kind === 'post' ? occasionIcon(page.post.occasion.key) : MapPin,
    badge: coverBadge(page),
    title: page.kind === 'post' ? page.post.title : (page.town ?? page.city).seo.title,
    address: `${new URL(SITE_CONFIG.url).host}${BLOG_PATH}`,
    photo: await coverPhoto(page),
  });
}

function coverBadge(page: BlogPage): string {
  if (page.kind === 'post') {
    const { occasion, areas } = page.post;
    const area = areas.at(-1);
    return area ? `${area.name} · ${occasion.label}` : occasion.label;
  }
  const { city, town } = page;
  return town ? `${town.name}, ${city.name}` : [city.name, city.region].filter(Boolean).join(', ');
}

async function coverPhoto(page: BlogPage): Promise<CardPhoto | undefined> {
  const image = pageCover(page);
  if (!image) return undefined;
  return { jpeg: await readPhotoFile(image), credit: coverCredit(image) };
}
