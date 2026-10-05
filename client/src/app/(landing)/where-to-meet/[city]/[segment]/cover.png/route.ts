import { coverResponse } from '@/features/guides/lib/cover';
import { segmentsAtDepth } from '@/features/guides/lib/source';

type Params = { city: string; segment: string };

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(2)).map(([city, segment]) => ({ city, segment }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { city, segment } = await params;
  return coverResponse([city, segment]);
}
