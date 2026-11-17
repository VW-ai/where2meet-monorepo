import type { Metadata } from 'next';
import { SiteFooter } from '@/features/landing/ui/site-footer';
import { SiteHeader } from '@/features/landing/ui/site-header';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Contact',
  description: 'Email victorzhang0218@gmail.com. We reply within a couple of days.',
  canonical: '/contact',
  robots: { index: true, follow: true },
});

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <SiteHeader className="mx-auto max-w-xl px-4 pt-4 sm:pt-5" />

      <main className="mx-auto max-w-xl px-4 pb-10 pt-8">
        <h1 className="mb-4 text-2xl font-bold tracking-[-0.6px]">Contact</h1>
        <div className="rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
          <p className="text-sm leading-relaxed text-[#666b73]">
            Email{' '}
            <a href="mailto:victorzhang0218@gmail.com" className="font-semibold text-[#bd3843]">
              victorzhang0218@gmail.com
            </a>
            . We reply within a couple of days.
          </p>
        </div>
      </main>
      <SiteFooter className="mx-auto max-w-xl px-4 pb-8" />
    </div>
  );
}
