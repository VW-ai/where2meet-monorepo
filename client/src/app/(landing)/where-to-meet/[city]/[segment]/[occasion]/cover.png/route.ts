import { coverResponse } from '@/features/guides/lib/cover';
import { segmentsAtDepth } from '@/features/guides/lib/source';

type Params = { city: string; segment: string; occasion: string };

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(3)).map(([city, segment, occasion]) => ({
    city,
    segment,
    occasion,
  }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { city, segment, occasion } = await params;
  return coverResponse([city, segment, occasion]);
}
