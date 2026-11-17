import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/features/landing/ui/site-footer';
import { SiteHeader } from '@/features/landing/ui/site-header';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  ...createMetadata({
    title: 'Page not found',
    description:
      "This page doesn't exist. Plan where to meet with your group, or read the guides to places that work for groups.",
  }),
  // Next.js marks every 404 response noindex itself. Null drops the root layout's "index, follow".
  robots: null,
};

const button =
  'inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <SiteHeader className="mx-auto max-w-xl px-4 pt-4 sm:pt-5" />

      <main className="mx-auto max-w-xl px-4 pb-10 pt-8">
        <h1 className="mb-4 text-2xl font-bold tracking-[-0.6px]">Page not found</h1>
        <div className="rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
          <p className="text-sm leading-relaxed text-[#666b73]">
            This page doesn&apos;t exist, or it moved. Start a plan on the home page, or find a
            convenient place for your group in the guides.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className={`${button} bg-[#c83f49] text-white hover:bg-[#b73540]`}>
              Plan together
            </Link>
            <Link
              href="/blog"
              className={`${button} bg-[#fff0ef] text-[#bc3942] hover:bg-[#ffe6e4]`}
            >
              Read the guides
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter className="mx-auto max-w-xl px-4 pb-8" />
    </div>
  );
}
