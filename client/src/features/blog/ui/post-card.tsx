import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BLOG_AUTHOR, coverPath, postPath, type BlogPost } from '@/content/blog/posts';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "The Where2Meet team · October 4, 2026", with an optional word before the date. */
export function Byline({
  date,
  prefix = '',
  className = '',
}: {
  date: string;
  prefix?: string;
  className?: string;
}) {
  return (
    <p className={`text-[13px] text-[#666b73] ${className}`}>
      {BLOG_AUTHOR} · {prefix && `${prefix} `}
      <time dateTime={date}>{dateFormat.format(new Date(date))}</time>
    </p>
  );
}

export function PostByline({ post, className = '' }: { post: BlogPost; className?: string }) {
  return <Byline date={post.publishedAt} className={className} />;
}

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <CoverCard
      href={postPath(post.slug)}
      cover={coverPath(post.slug)}
      title={post.title}
      description={post.description}
    >
      <PostByline post={post} className="mt-3" />
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
