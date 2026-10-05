import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { guidesPageMetadata } from '@/features/guides/lib/seo';
import { loadPage, segmentsAtDepth } from '@/features/guides/lib/source';
import { GuidesPageView } from '@/features/guides/ui/guides-page';

type Params = { city: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await segmentsAtDepth(1)).map(([city]) => ({ city }));
}

async function findPage(params: Promise<Params>) {
  const { city } = await params;
  return (await loadPage([city])) ?? notFound();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return guidesPageMetadata(await findPage(params));
}

export default async function CityHubPage({ params }: { params: Promise<Params> }) {
  return <GuidesPageView page={await findPage(params)} />;
}
