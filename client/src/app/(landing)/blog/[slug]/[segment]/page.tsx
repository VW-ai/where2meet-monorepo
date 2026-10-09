import type { Metadata } from 'next';
import { segmentsAtDepth } from '@/features/blog/lib/source';
import { BlogRoute, blogMetadata } from '@/features/blog/ui/blog-route';

type Params = { slug: string; segment: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(2)).map(([slug, segment]) => ({ slug, segment }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, segment } = await params;
  return blogMetadata([slug, segment]);
}

export default async function TownOrCityPostPage({ params }: { params: Promise<Params> }) {
  const { slug, segment } = await params;
  return <BlogRoute segments={[slug, segment]} />;
}
