import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StructuredData } from '@/components/seo/structured-data';
import { themeItemList } from '@/features/nyc-map/lib/json-ld';
import { loadLiveTheme, loadLiveThemes } from '@/features/nyc-map/lib/source';
import { themePath } from '@/features/nyc-map/model/themes';
import { ThemeMap } from '@/features/nyc-map/ui/theme-map';
import { createMetadata } from '@/lib/seo/metadata';

type Params = Promise<{ theme: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await loadLiveThemes()).map((theme) => ({ theme: theme.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const theme = await loadLiveTheme((await params).theme);
  if (!theme) return {};
  return createMetadata({
    title: theme.title,
    description: theme.description,
    canonical: themePath(theme),
  });
}

export default async function NycThemePage({ params }: { params: Params }) {
  const theme = await loadLiveTheme((await params).theme);
  if (!theme) notFound();
  const themes = (await loadLiveThemes()).map(({ slug, name }) => ({ slug, name }));
  return (
    <>
      <StructuredData data={themeItemList(theme)} />
      <ThemeMap theme={theme} themes={themes} />
    </>
  );
}
