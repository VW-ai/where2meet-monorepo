import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import { generateFAQSchema, type FAQItem } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/seo/structured-data';
import catLogo from '@/components/cat/logo.svg';

export const metadata: Metadata = createMetadata({
  title: 'FAQ',
  description:
    'Answers about planning where to meet with Where2Meet: accounts, sharing a link, hiding your exact address, travel modes, voting and cost.',
  canonical: '/faq',
  robots: { index: true, follow: true },
});

const faqs: FAQItem[] = [
  {
    question: 'How do I plan where to meet with a group?',
    answer:
      "Create a meeting with a title and a time, then share the link. Everyone adds where they're coming from. Search for places around the group, compare everyone's travel time on the map, and vote for the places you'd go to. The organizer then picks the final spot.",
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. Name the meeting, pick a time, and share the link. An account only saves your meetings in one place.',
  },
  {
    question: 'Does everyone else need one?',
    answer: "No. People open the link, add where they're coming from, and vote.",
  },
  {
    question: 'How is the spot chosen?',
    answer:
      "By travel time, not straight-line distance. Select a place to see each person's route and trip time. Everyone votes for the places that work for them, then the organizer picks the final spot.",
  },
  {
    question: 'Which ways of getting there can we compare?',
    answer:
      "Car, transit, walking and bike. Switch between them to see how each person's trip changes.",
  },
  {
    question: 'Do I have to share my exact address?',
    answer:
      'No. Turn on "Hide exact address" and others see only an approximate area, about half a mile to a mile around you.',
  },
  {
    question: 'What kinds of places can we search for?',
    answer: 'Cafes, restaurants, bars or anything else nearby, or a specific place by name.',
  },
  {
    question: 'Is Where2Meet free?',
    answer: 'Yes. Creating a meeting and joining one are free.',
  },
  {
    question: 'Does it work on my phone?',
    answer: "Yes. It runs in your phone's browser, so there's nothing to install.",
  },
  {
    question: 'Is Where2Meet the same as When2meet?',
    answer:
      "No, and the two aren't affiliated. When2meet helps a group find a time. Where2Meet helps a group pick the place.",
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
