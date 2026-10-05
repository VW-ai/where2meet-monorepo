import type { Metadata } from 'next';
import type { MDXContent } from 'mdx/types';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  BLOG_POSTS,
  OCCASIONS,
  coverPath,
  getPost,
  postPath,
  type BlogPost,
} from '@/content/blog/posts';
import { PlanCta } from '@/features/blog/ui/plan-cta';
import { PostByline, PostCard } from '@/features/blog/ui/post-card';
import { StructuredData } from '@/components/seo/structured-data';
import { createArticleMetadata } from '@/lib/seo/metadata';
import { generateBlogPostingSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

async function findPost(params: BlogPostPageProps['params']): Promise<BlogPost> {
  const post = getPost((await params).slug);
  if (!post) notFound();
  return post;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await findPost(params);
  return createArticleMetadata({
    title: post.title,
    description: post.description,
    canonical: postPath(post.slug),
    image: { url: coverPath(post.slug), alt: post.coverAlt },
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await findPost(params);
  const Body: MDXContent = (await import(`@/content/blog/${post.slug}.mdx`)).default;
  const occasion = OCCASIONS[post.occasion].label.toLowerCase();
  const otherPosts = BLOG_POSTS.filter(({ slug }) => slug !== post.slug);

  return (
    <>
      <StructuredData
        data={generateBlogPostingSchema({
          ...post,
          path: postPath(post.slug),
          coverPath: coverPath(post.slug),
        })}
      />
      <StructuredData
        data={generateBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: postPath(post.slug) },
        ])}
      />

      <article>
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#666b73] hover:text-[#bd3843]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Blog
        </Link>
        <h1 className="mt-4 text-[28px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[36px]">
          {post.title}
        </h1>
        <PostByline post={post} className="mt-3" />
        <Image
          src={coverPath(post.slug)}
          alt={post.coverAlt}
          width={1200}
          height={630}
          sizes="(min-width: 672px) 640px, 100vw"
          priority
          className="mt-6 aspect-[1200/630] w-full rounded-[28px] bg-white shadow-[0_4px_24px_rgba(23,37,45,0.1)]"
        />
        <div className="mt-6 rounded-[28px] bg-white p-5 text-base leading-[1.7] text-[#3a3f46] shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-8 sm:text-[17px]">
          <Body />
        </div>
      </article>

      <PlanCta heading={`Plan your ${occasion} on Where2Meet`} />

      {otherPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-[-0.3px]">More from the blog</h2>
          <ul className="mt-4 space-y-5">
            {otherPosts.map((other) => (
              <li key={other.slug}>
                <PostCard post={other} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
