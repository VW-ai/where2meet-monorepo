import type { Metadata } from 'next';
import { BLOG_POSTS } from '@/content/blog/posts';
import { PostCard } from '@/features/blog/ui/post-card';
import { StructuredData } from '@/components/seo/structured-data';
import { createMetadata } from '@/lib/seo/metadata';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

export const metadata: Metadata = createMetadata({
  title: 'Blog',
  description:
    'Guides to planning where to meet with your group: compare travel times, choose a venue that suits the occasion, and agree on a place together.',
  canonical: '/blog',
  robots: { index: true, follow: true },
});

export default function BlogIndexPage() {
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
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
    </>
  );
}
