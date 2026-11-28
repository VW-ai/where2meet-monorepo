import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NYC_PATH } from '@/features/nyc-map/model/themes';
import { loadThemes } from '@/features/nyc-map/lib/source';
import { ThemeTiles } from '@/features/nyc-map/ui/theme-tiles';
import { createMetadata } from '@/lib/seo/metadata';
import catLogo from '@/components/cat/logo.svg';

export const metadata: Metadata = createMetadata({
  title: 'Things to do with friends in NYC, by theme',
  description:
    'Maps of New York City spots by theme: ponds with ducks, indoor places for rainy or cold days, and study spots. Pick a place and plan the meetup in Where2Meet.',
  canonical: NYC_PATH,
});

export default async function NycPage() {
  const themes = await loadThemes();
  return (
    <div className="min-h-svh bg-[#f4f5f7] text-[#21252b]">
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-8 sm:pt-8">
        <Link
          href="/"
          className="inline-flex rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.12)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
        >
          <Image src={catLogo} alt="Where2Meet home" width={36} height={36} className="h-9 w-9" />
        </Link>
        <h1 className="mt-6 text-[30px] font-bold leading-[1.08] tracking-[-0.8px] sm:mt-10 sm:text-[44px]">
          Where should we go in NYC?
        </h1>
        <p className="mb-6 mt-2 text-[15px] text-[#5b6169] sm:mb-8">
          Pick a theme, open its map, and start a plan from any pin.
        </p>
        <ThemeTiles themes={themes} />
      </main>
    </div>
  );
}
