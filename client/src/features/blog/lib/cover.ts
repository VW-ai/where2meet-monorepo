import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MapPin } from 'lucide';
import { coverPhotoFile } from '@/content/blog/posts';
import { renderArticleCover, type CardPhoto } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { BLOG_PATH, type BlogPage } from './catalog';
import { occasionIcon } from './occasion-icon';
import type { CommonsImage, Photo } from './photos';
import { fetchPhoto, isBuilding, loadPage, warnOnce } from './source';

/** A page's 1200x630 cover, or a 404 when nothing is published there. */
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

/** "Team meeting" on a general post, "Midtown · Team meeting" on a local one, "Midtown, New York" on a town. */
function coverBadge(page: BlogPage): string {
  if (page.kind === 'post') {
    const { occasion, areas } = page.post;
    const area = areas.at(-1);
    return area ? `${area.name} · ${occasion.label}` : occasion.label;
  }
  const { city, town } = page;
  return town ? `${town.name}, ${city.name}` : [city.name, city.region].filter(Boolean).join(', ');
}

/**
 * A repo post's photo is a file in the repo; a panel photo comes from Wikimedia. A build
 * draws the map when Wikimedia fails, and the cover picks up its photo on revalidation.
 */
async function coverPhoto(page: BlogPage): Promise<CardPhoto | undefined> {
  if (page.kind === 'post' && page.post.source.kind === 'repo') {
    const file = path.join(process.cwd(), coverPhotoFile(page.post.slug));
    return { jpeg: await readFile(file), credit: creditLine(page.post.source.cover) };
  }
  const image = commonsCover(page);
  if (!image) return undefined;
  try {
    const response = await fetchPhoto(image);
    return { jpeg: Buffer.from(await response.arrayBuffer()), credit: creditLine(image) };
  } catch (error) {
    if (!isBuilding()) throw error;
    warnOnce(`Drawing the map on a cover. ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

function commonsCover(page: BlogPage): CommonsImage | null {
  if (page.kind === 'area') return (page.town ?? page.city).image;
  return page.post.source.kind === 'panel' ? page.post.source.images[0] : null;
}

/** "Phi, CC0" */
function creditLine({ credit }: Photo): string {
  return `${credit.author}, ${credit.license}`;
}
