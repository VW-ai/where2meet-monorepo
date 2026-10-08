import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { guidesPageMetadata } from '@/features/guides/lib/seo';
import { loadPage, segmentsAtDepth } from '@/features/guides/lib/source';
import { GuidesPageView } from '@/features/guides/ui/guides-page';

/** `segment` is a town's slug for its hub, otherwise a city guide's slug. */
type Params = { city: string; segment: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(2)).map(([city, segment]) => ({ city, segment }));
}

async function findPage(params: Promise<Params>) {
  const { city, segment } = await params;
  return (await loadPage([city, segment])) ?? notFound();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return guidesPageMetadata(await findPage(params));
}

export default async function CityGuideOrTownHubPage({ params }: { params: Promise<Params> }) {
  return <GuidesPageView page={await findPage(params)} />;
}
