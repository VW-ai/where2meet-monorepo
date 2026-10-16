import Image from 'next/image';
import Link from 'next/link';
import { BLOG_AUTHOR, postPath, type Post } from '@/features/blog/lib/catalog';
import { CONTENT_WIDTH_SIZES, CreditLine, photoLoading } from './photo-figure';

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
      <Link href="/about" className="relative hover:text-[#bd3843]">
        {BLOG_AUTHOR}
      </Link>{' '}
      · Published <DateTime date={post.publishedAt} /> · Updated <DateTime date={post.updatedAt} />
    </p>
  );
}

export function PostCard({ post, aboveFold = false }: { post: Post; aboveFold?: boolean }) {
  const [photo] = post.images;
  return (
    <article className="group relative overflow-hidden rounded-[28px] bg-white shadow-[0_4px_24px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(23,37,45,0.14)] has-[h2_a:focus-visible]:outline has-[h2_a:focus-visible]:outline-2 has-[h2_a:focus-visible]:outline-offset-2 has-[h2_a:focus-visible]:outline-[#b73540] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={CONTENT_WIDTH_SIZES}
        {...photoLoading(aboveFold)}
        className="aspect-[1200/630] w-full bg-[#eef1f4] object-cover"
      />
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold leading-snug tracking-[-0.3px] group-hover:text-[#bc3942] sm:text-xl">
          <Link href={postPath(post)} className="after:absolute after:inset-0 focus:outline-none">
            {post.title}
          </Link>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#666b73]">{post.description}</p>
        <Byline post={post} className="mt-3" />
        <p className="relative mt-2 text-xs leading-relaxed text-[#666b73]">
          <CreditLine credit={{ ...photo.credit, cropped: true }} />
        </p>
      </div>
    </article>
  );
}
