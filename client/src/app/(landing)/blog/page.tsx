import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StructuredData } from '@/components/seo/structured-data';
import {
  citiesWithPosts,
  inArea,
  pagePath,
  postPath,
  type Post,
} from '@/features/blog/lib/catalog';
import { loadCatalog } from '@/features/blog/lib/source';
import { LinkCards, cityCard } from '@/features/blog/ui/blog-page';
import { PlanLink } from '@/features/blog/ui/plan-cta';
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

/** The rest of a city's posts are on its city page, which each shelf links. */
const POSTS_PER_CITY = 6;

interface Shelf {
  heading: string;
  posts: Post[];
  more: { href: string; label: string } | null;
}

const sectionHeading = 'text-lg font-bold tracking-[-0.3px]';

export default async function BlogIndexPage() {
  const catalog = await loadCatalog();
  const cities = citiesWithPosts(catalog);
  const general = catalog.posts.filter(({ areas }) => areas.length === 0);
  const shelves: Shelf[] = [
    ...cities.map(({ city, posts }) => ({
      heading: `Newest guides ${inArea(city)}`,
      posts: posts.slice(0, POSTS_PER_CITY),
      more: {
        href: pagePath({ kind: 'area', city, town: null }),
        label: `See all guides ${inArea(city)}`,
      },
    })),
    ...(general.length > 0 ? [{ heading: 'Guides for any city', posts: general, more: null }] : []),
  ];

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
      <PlanLink label="Plan where to meet with your group" className="mt-5" />
      {cities.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>Guides by city</h2>
          <LinkCards cards={cities.map(({ city }) => cityCard(city))} />
        </section>
      )}
      {shelves.map((shelf, shelfIndex) => (
        <section key={shelf.heading} className="mt-10">
          <h2 className={sectionHeading}>{shelf.heading}</h2>
          <ul className="mt-4 space-y-5">
            {shelf.posts.map((post, index) => (
              <li key={postPath(post)}>
                <PostCard post={post} aboveFold={shelfIndex === 0 && index === 0} />
              </li>
            ))}
          </ul>
          {shelf.more && (
            <Link
              href={shelf.more.href}
              className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-4 font-semibold text-[#bc3942] shadow-[0_2px_14px_rgba(23,37,45,0.09)] transition-shadow hover:shadow-[0_6px_22px_rgba(23,37,45,0.14)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
            >
              {shelf.more.label}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>
      ))}
    </>
  );
}
