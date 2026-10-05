import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { guidesPageMetadata } from '@/features/guides/lib/seo';
import { loadPage, segmentsAtDepth } from '@/features/guides/lib/source';
import { GuidesPageView } from '@/features/guides/ui/guides-page';

/** `segment` is the town's slug: Next needs one name per URL level. */
type Params = { city: string; segment: string; occasion: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(3)).map(([city, segment, occasion]) => ({
    city,
    segment,
    occasion,
  }));
}

async function findPage(params: Promise<Params>) {
  const { city, segment, occasion } = await params;
  return (await loadPage([city, segment, occasion])) ?? notFound();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return guidesPageMetadata(await findPage(params));
}

export default async function TownGuidePage({ params }: { params: Promise<Params> }) {
  return <GuidesPageView page={await findPage(params)} />;
}
