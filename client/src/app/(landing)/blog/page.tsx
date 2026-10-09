import type { Metadata } from 'next';
import { StructuredData } from '@/components/seo/structured-data';
import { postPath } from '@/features/blog/lib/catalog';
import { loadCatalog } from '@/features/blog/lib/source';
import { LinkCards, cityCard } from '@/features/blog/ui/blog-page';
import { PostCard } from '@/features/blog/ui/post-card';
import { createMetadata } from '@/lib/seo/metadata';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

export const metadata: Metadata = createMetadata({
  title: 'Blog',
  description:
    'Guides to planning where to meet with your group: compare travel times, choose a venue that suits the occasion, and agree on a place together.',
  canonical: '/blog',
  robots: { index: true, follow: true },
});

export default async function BlogIndexPage() {
  const { posts, cities } = await loadCatalog();
  return (
    <>
      <StructuredData
        data={generateBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
        ])}
      />
      <h1 className="text-2xl font-bold tracking-[-0.6px]">Blog</h1>
      <p className="mt-1 text-sm text-[#666b73]">
        Guides to planning where to meet with friends, family and coworkers.
      </p>
      <ul className="mt-6 space-y-5">
        {posts.map((post) => (
          <li key={postPath(post)}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
      {cities.size > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-[-0.3px]">Guides by city</h2>
          <LinkCards cards={[...cities.values()].map(cityCard)} />
        </section>
      )}
    </>
  );
}
