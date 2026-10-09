import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BLOG_AUTHOR } from '@/content/blog/posts';
import { coverPath, postPath, type Post } from '@/features/blog/lib/catalog';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function DateTime({ date }: { date: string }) {
  return <time dateTime={date}>{dateFormat.format(new Date(date))}</time>;
}

export function Byline({ post, className = '' }: { post: Post; className?: string }) {
  return (
    <p className={`text-[13px] text-[#666b73] ${className}`}>
      {BLOG_AUTHOR} · Published <DateTime date={post.publishedAt} /> · Updated{' '}
      <DateTime date={post.updatedAt} />
    </p>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <CoverCard
      href={postPath(post)}
      cover={coverPath({ kind: 'post', post })}
      title={post.title}
      description={post.description}
    >
      <Byline post={post} className="mt-3" />
    </CoverCard>
  );
}

/** A linked card with a 1200x630 cover on top, as on the blog index. */
export function CoverCard({
  href,
  cover,
  title,
  description,
  children,
}: {
  href: string;
  cover: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[28px] bg-white shadow-[0_4px_24px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(23,37,45,0.14)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Image
        src={cover}
        alt=""
        width={1200}
        height={630}
        sizes="(min-width: 896px) 864px, 100vw"
        className="aspect-[1200/630] w-full bg-[#eef1f4]"
      />
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold leading-snug tracking-[-0.3px] group-hover:text-[#bc3942] sm:text-xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#666b73]">{description}</p>
        {children}
      </div>
    </Link>
  );
}
