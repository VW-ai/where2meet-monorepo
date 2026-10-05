import { BLOG_POSTS, OCCASIONS, getPost } from '@/content/blog/posts';
import { renderArticleCover } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) return new Response('Not found', { status: 404 });
  const occasion = OCCASIONS[post.occasion];

  return renderArticleCover({
    icon: occasion.icon,
    badge: occasion.label,
    title: post.title,
    address: `${new URL(SITE_CONFIG.url).host}/blog`,
  });
}
