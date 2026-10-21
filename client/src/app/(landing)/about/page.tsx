import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import { generateAboutPageSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/seo/structured-data';
import catLogo from '@/components/cat/logo.svg';

export const metadata: Metadata = createMetadata({
  title: 'About',
  description:
    'Where2Meet is a free web app where a group plans where to meet together: everyone adds where they are coming from, compares travel times and votes on a convenient spot.',
  canonical: '/about',
  robots: { index: true, follow: true },
});

const sections = [
  {
    heading: 'What Where2Meet is',
    body: "Where2Meet is a free web app for planning where to meet with a group. One person creates a meeting and shares the link. Everyone adds where they're coming from, and the group compares each person's travel time to a place before voting on a convenient spot.",
  },
  {
    heading: 'Why we built it',
    body: 'Picking a place for a group usually means a long chat thread, a few map screenshots and someone guessing what works for everyone. We wanted one link where the whole group can see the options, see how far each place is for each person, and decide together.',
  },
  {
    heading: 'How it works',
    body: 'Places and routes come from Google Maps. Travel times are real trip times by car, transit, walking or bike, not straight-line distance. Nobody needs an account to join, and anyone can enter a nearby cross street or neighborhood instead of their home address.',
  },
  {
    heading: 'Our guides',
    body: 'The Where2Meet blog has guides to places that work for groups in different cities, from team lunches to group dinners. Every guide names real places, and its photos are credited to their authors.',
  },
  {
    heading: 'Who we are',
    body: 'Where2Meet is made by a small independent team and has been around since 2025. It is not affiliated with When2meet, which helps a group find a time. Where2Meet helps a group pick the place.',
  },
];

const links = [
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export default function AboutPage() {
  return (
    <>
      <StructuredData data={generateAboutPageSchema()} />

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
          <h1 className="mb-4 text-2xl font-bold tracking-[-0.6px]">About Where2Meet</h1>
          <div className="space-y-5 rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-sm font-semibold">{section.heading}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#666b73]">{section.body}</p>
              </section>
            ))}
            <p className="text-sm leading-relaxed text-[#666b73]">
              Questions or feedback? Email{' '}
              <a href="mailto:victorzhang0218@gmail.com" className="font-semibold text-[#bd3843]">
                victorzhang0218@gmail.com
              </a>
              .
            </p>
          </div>
          <nav className="mt-4 flex justify-center gap-5 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-[#666b73] hover:text-[#bd3843]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </>
  );
}
