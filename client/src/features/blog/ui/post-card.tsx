import Image from 'next/image';
import Link from 'next/link';
import { BLOG_AUTHOR, coverPath, postPath, type BlogPost } from '@/content/blog/posts';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function PostByline({ post, className = '' }: { post: BlogPost; className?: string }) {
  return (
    <p className={`text-[13px] text-[#666b73] ${className}`}>
      {BLOG_AUTHOR} ·{' '}
      <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
    </p>
  );
}

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={postPath(post.slug)}
      className="group block overflow-hidden rounded-[28px] bg-white shadow-[0_4px_24px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(23,37,45,0.14)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Image
        src={coverPath(post.slug)}
        alt=""
        width={1200}
        height={630}
        sizes="(min-width: 672px) 640px, 100vw"
        className="aspect-[1200/630] w-full bg-[#eef1f4]"
      />
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold leading-snug tracking-[-0.3px] group-hover:text-[#bc3942] sm:text-xl">
          {post.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#666b73]">{post.description}</p>
        <PostByline post={post} className="mt-3" />
      </div>
    </Link>
  );
}
