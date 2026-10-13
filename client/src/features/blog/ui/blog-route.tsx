import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPage } from '@/features/blog/lib/catalog';
import { blogPageMetadata } from '@/features/blog/lib/seo';
import { loadCatalog, loadPage } from '@/features/blog/lib/source';
import { BlogPageView } from './blog-page';

export async function BlogRoute({ segments }: { segments: readonly string[] }) {
  const catalog = await loadCatalog();
  const page = findPage(catalog, segments) ?? notFound();
  return <BlogPageView page={page} catalog={catalog} />;
}

export async function blogMetadata(segments: readonly string[]): Promise<Metadata> {
  return blogPageMetadata((await loadPage(segments)) ?? notFound());
}
