import { BLOG_POSTS, OCCASIONS, getPost } from '@/content/blog/posts';
import { ACCENT, iconDataUri, renderShareCard } from '@/lib/og/share-card';
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

  return renderShareCard({
    pin: { icon: occasion.icon },
    text: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 28,
            padding: '8px 20px 8px 10px',
            borderRadius: 30,
            backgroundColor: '#fff',
            boxShadow: '0 3px 16px rgba(23, 37, 45, 0.12)',
            fontSize: 24,
            fontWeight: 600,
            color: ACCENT,
          }}
        >
          <img src={iconDataUri(occasion.icon, ACCENT, 2.4)} width={28} height={28} alt="" />
          <div style={{ marginLeft: 10 }}>{occasion.label}</div>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            textWrap: 'balance',
          }}
        >
          {post.title}
        </div>
        <div style={{ marginTop: 28, fontSize: 26, fontWeight: 600, color: ACCENT }}>
          {`${new URL(SITE_CONFIG.url).host}/blog`}
        </div>
      </div>
    ),
  });
}
