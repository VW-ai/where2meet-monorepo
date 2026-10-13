import { coverResponse } from '@/features/blog/lib/cover';
import { segmentsAtDepth } from '@/features/blog/lib/source';

type Params = { slug: string; segment: string; post: string };

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(3)).map(([slug, segment, post]) => ({ slug, segment, post }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { slug, segment, post } = await params;
  return coverResponse([slug, segment, post]);
}
