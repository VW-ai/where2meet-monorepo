import type { Metadata } from 'next';
import { segmentsAtDepth } from '@/features/blog/lib/source';
import { BlogRoute, blogMetadata } from '@/features/blog/ui/blog-route';

type Params = { slug: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(1)).map(([slug]) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return blogMetadata([slug]);
}

export default async function BlogSlugPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <BlogRoute segments={[slug]} />;
}
