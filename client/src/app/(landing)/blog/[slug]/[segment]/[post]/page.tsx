import type { Metadata } from 'next';
import { segmentsAtDepth } from '@/features/blog/lib/source';
import { BlogRoute, blogMetadata } from '@/features/blog/ui/blog-route';

type Params = { slug: string; segment: string; post: string };

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(3)).map(([slug, segment, post]) => ({ slug, segment, post }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, segment, post } = await params;
  return blogMetadata([slug, segment, post]);
}

export default async function TownPostPage({ params }: { params: Promise<Params> }) {
  const { slug, segment, post } = await params;
  return <BlogRoute segments={[slug, segment, post]} />;
}
