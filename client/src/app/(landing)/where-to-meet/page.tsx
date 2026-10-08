import type { Metadata } from 'next';
import Link from 'next/link';
import { StructuredData } from '@/components/seo/structured-data';
import { CoverCard } from '@/features/blog/ui/post-card';
import { GUIDES_PATH, coverPath, pagePath, type HubPage } from '@/features/guides/lib/catalog';
import { loadCatalog } from '@/features/guides/lib/source';
import { createMetadata } from '@/lib/seo/metadata';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

/** Kept out of search results until a city is published, since the empty page says little. */
export async function generateMetadata(): Promise<Metadata> {
  const { cities } = await loadCatalog();
  return createMetadata({
    title: 'Where to meet',
    description:
      'Local guides to places that work for groups, from team meetings to date nights, picked by the Where2Meet team with tips on getting there.',
    canonical: GUIDES_PATH,
    robots: { index: cities.size > 0, follow: true },
  });
}

export default async function WhereToMeetPage() {
  const { cities } = await loadCatalog();

  return (
    <>
      <StructuredData
        data={generateBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Where to meet', path: GUIDES_PATH },
        ])}
      />
      <h1 className="text-2xl font-bold tracking-[-0.6px]">Where to meet</h1>
      <p className="mt-1 text-sm text-[#666b73]">
        Local guides to places that work for groups, picked by the Where2Meet team.
      </p>
      {cities.size > 0 ? (
        <ul className="mt-6 space-y-5">
          {[...cities.values()].map((city) => {
            const hub: HubPage = { kind: 'hub', city, town: null };
            return (
              <li key={city.slug}>
                <CoverCard
                  href={pagePath(hub)}
                  cover={coverPath(hub)}
                  title={city.seo.title}
                  description={city.seo.description}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-[20px] bg-white px-5 py-8 text-center text-sm text-[#3a3f46] shadow-[0_2px_14px_rgba(23,37,45,0.09)]">
          The first city guides are on their way. Until then, the{' '}
          <Link href="/blog" className="font-medium text-[#bc3942] underline underline-offset-2">
            blog
          </Link>{' '}
          has tips on planning where to meet.
        </p>
      )}
    </>
  );
}
