import { coverResponse } from '@/features/blog/lib/cover';
import { segmentsAtDepth } from '@/features/blog/lib/source';

type Params = { slug: string };

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(1)).map(([slug]) => ({ slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return coverResponse([slug]);
}
