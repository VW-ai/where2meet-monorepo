import { coverResponse } from '@/features/guides/lib/cover';
import { segmentsAtDepth } from '@/features/guides/lib/source';

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await segmentsAtDepth(1)).map(([city]) => ({ city }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return coverResponse([city]);
}
