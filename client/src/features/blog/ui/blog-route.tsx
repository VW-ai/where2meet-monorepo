import 'server-only';
import type { Metadata } from 'next';
import type { MDXContent } from 'mdx/types';
import { notFound } from 'next/navigation';
import { findPage, type BlogPage } from '@/features/blog/lib/catalog';
import { blogPageMetadata } from '@/features/blog/lib/seo';
import { loadCatalog, loadPage } from '@/features/blog/lib/source';
import { BlogPageView } from './blog-page';

export async function BlogRoute({ segments }: { segments: readonly string[] }) {
  const catalog = await loadCatalog();
  const page = findPage(catalog, segments) ?? notFound();
  return <BlogPageView page={page} catalog={catalog} Mdx={await repoBody(page)} />;
}

export async function blogMetadata(segments: readonly string[]): Promise<Metadata> {
  return blogPageMetadata((await loadPage(segments)) ?? notFound());
}

async function repoBody(page: BlogPage): Promise<MDXContent | undefined> {
  if (page.kind !== 'post' || page.post.source.kind !== 'mdx') return undefined;
  return (await import(`@/content/blog/${page.post.slug}.mdx`)).default;
}
