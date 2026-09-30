import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import { generateFAQSchema, type FAQItem } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/seo/structured-data';
import catLogo from '@/components/cat/image.png';

export const metadata: Metadata = createMetadata({
  title: 'FAQ',
  description:
    'No account needed. Share a link. Spots are chosen by travel time, then the group votes.',
  canonical: '/faq',
  robots: { index: true, follow: true },
  keywordsFocus: 'differentiation',
});

const faqs: FAQItem[] = [
  {
    question: 'Do I need an account?',
    answer:
      'No. Name the meeting, pick a time, and share the link. An account only saves your events in one place.',
  },
  {
    question: 'Does everyone else need one?',
    answer: 'No. People open the link, add where they are, and vote.',
  },
  {
    question: 'How is the spot chosen?',
    answer:
      'By travel time, not straight-line distance. Routes are compared so nobody gets a much longer trip, then the group votes.',
  },
];

export default function FAQPage() {
  return (
    <>
      <StructuredData data={generateFAQSchema(faqs)} />

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
          <h1 className="mb-4 text-2xl font-bold tracking-[-0.6px]">FAQ</h1>
          <div className="space-y-5 rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
            {faqs.map((faq) => (
              <section key={faq.question}>
                <h2 className="text-sm font-semibold">{faq.question}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#666b73]">{faq.answer}</p>
              </section>
            ))}
          </div>
          <p className="mt-4 text-center text-sm">
            <Link href="/contact" className="font-medium text-[#666b73] hover:text-[#bd3843]">
              Contact
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
