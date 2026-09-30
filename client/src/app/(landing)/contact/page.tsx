import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import catLogo from '@/components/cat/image.png';

export const metadata: Metadata = createMetadata({
  title: 'Contact',
  description: 'Email contact@wayvi-ai.com. We reply within a couple of days.',
  canonical: '/contact',
  robots: { index: true, follow: true },
});

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <header className="mx-auto max-w-xl px-4 pt-4 sm:pt-5">
        <Link
          href="/"
          aria-label="Where2Meet"
          className="inline-flex items-center rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
        >
          <Image src={catLogo} alt="Where2Meet" width={36} height={36} className="h-9 w-9" />
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-10 pt-8">
        <h1 className="mb-4 text-2xl font-bold tracking-[-0.6px]">Contact</h1>
        <div className="rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
          <p className="text-sm leading-relaxed text-[#666b73]">
            Email{' '}
            <a href="mailto:contact@wayvi-ai.com" className="font-semibold text-[#bd3843]">
              contact@wayvi-ai.com
            </a>
            . We reply within a couple of days.
          </p>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/faq" className="font-medium text-[#666b73] hover:text-[#bd3843]">
            FAQ
          </Link>
        </p>
      </main>
    </div>
  );
}
