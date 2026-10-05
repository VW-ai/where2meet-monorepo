import type { Metadata } from 'next';
import { createArticleMetadata, createMetadata } from '@/lib/seo/metadata';
import { coverPath, pageEntry, pagePath, type GuidesPage } from './catalog';

/** Describes the drawing only; the title it shows is already the page's heading. */
export const COVER_ALT = 'Three routes meeting at a pin on a city map, next to the title.';

/** Guides are articles dated by their last update; hubs are plain pages. */
export function guidesPageMetadata(page: GuidesPage): Metadata {
  const { seo, updatedAt } = pageEntry(page);
  const shared = {
    title: seo.title,
    description: seo.description,
    canonical: pagePath(page),
    image: { url: coverPath(page), alt: COVER_ALT },
  };
  return page.kind === 'guide'
    ? createArticleMetadata({ ...shared, publishedTime: updatedAt, modifiedTime: updatedAt })
    : createMetadata({ ...shared, robots: { index: true, follow: true } });
}
