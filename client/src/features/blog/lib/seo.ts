import type { Metadata } from 'next';
import { createArticleMetadata, createMetadata } from '@/lib/seo/metadata';
import { coverPath, pagePath, postCover, type BlogPage } from './catalog';

const MAP_COVER_ALT = 'Three routes meeting at a pin on a city map, next to the title.';

export function blogPageMetadata(page: BlogPage): Metadata {
  const shared = {
    canonical: pagePath(page),
    image: { url: coverPath(page), alt: coverAlt(page) },
  };
  if (page.kind === 'post') {
    const { post } = page;
    return createArticleMetadata({
      ...shared,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    });
  }
  const { seo } = page.town ?? page.city;
  return createMetadata({
    ...shared,
    title: seo.title,
    description: seo.description,
    robots: { index: true, follow: true },
  });
}

function coverAlt(page: BlogPage): string {
  if (page.kind === 'post' && page.post.source.kind === 'repo') return page.post.source.cover.alt;
  const photo = page.kind === 'post' ? postCover(page.post) : (page.town ?? page.city).image;
  return photo ? `${photo.alt.replace(/\.$/, '')}, next to the title.` : MAP_COVER_ALT;
}
