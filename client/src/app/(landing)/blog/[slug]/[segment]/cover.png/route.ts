import { coverResponse } from '@/features/blog/lib/cover';
import { segmentsAtDepth } from '@/features/blog/lib/source';

type Params = { slug: string; segment: string };

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(2)).map(([slug, segment]) => ({ slug, segment }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { slug, segment } = await params;
  return coverResponse([slug, segment]);
}
