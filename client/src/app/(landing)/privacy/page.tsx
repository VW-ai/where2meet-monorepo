import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import catLogo from '@/components/cat/logo.svg';

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy',
  description:
    'What Where2Meet collects when you plan a meeting, who can see it, which services process it, and how to delete it.',
  canonical: '/privacy',
  robots: { index: true, follow: true },
});

const sections = [
  {
    heading: 'What you give us',
    items: [
      'Meetings: the name and time, the names and starting points people enter, the coordinates we look up for those starting points, likes, searches, and the place you choose.',
      'Accounts, which are optional: your email, your name, a default address if you set one, and your password, which we store only as a hash.',
    ],
  },
  {
    heading: 'Who can see a meeting',
    items: [
      'Anyone with a meeting link can see that meeting, including the names and starting points in it. Only share a link with people you want to see those details.',
      'The Where2Meet team can see meeting details to run and improve the service.',
    ],
  },
  {
    heading: 'What we record about use',
    items: [
      'For people who have joined a meeting, we record when they had the meeting open and what they searched for, along with how many results came back.',
      'The website uses Google Analytics and PostHog to measure pages visited, clicks and device type. If you sign in on the website, PostHog also receives your account ID, email and name.',
      'PostHog records sessions on meeting pages. A recording shows how the page was used and can include what was on screen, such as names and addresses.',
      'The iPhone app does not include Google Analytics or PostHog.',
    ],
  },
  {
    heading: 'iPhone permissions',
    items: [
      'Location is used only when you choose your current location as a starting point. We do not track your location in the background.',
      'Photos and Calendar are used only to add your ticket or your plan when you ask. The app does not read your photos or your calendar.',
    ],
  },
  {
    heading: 'Services that process your data',
    items: [
      'Google Maps Platform handles maps, addresses, places and travel times. AMap does the same for meetings in mainland China.',
      'Vercel hosts the website and Railway hosts our servers and database.',
      'Google Analytics and PostHog provide the website measurement described above.',
      'We do not sell your personal information or use it for advertising.',
    ],
  },
  {
    heading: 'How long we keep it',
    items: [
      'We keep meetings until their organizer deletes them, and accounts until you delete them. We do not currently delete them automatically after a set time.',
    ],
  },
  {
    heading: 'Delete your data',
    items: [
      'In the iPhone app, open Your account and tap Delete account. This takes effect right away and cannot be undone.',
      'Deleting your account removes your email, name, password and sessions. Meetings you organized that nobody else joined are deleted.',
      'Meetings other people joined stay available to them. Your name in those meetings becomes “Former guest”, and your starting point, access and usage history in them are removed.',
      'To delete your account from the website, remove analytics data, or remove a meeting you no longer have access to, email us.',
    ],
  },
  {
    heading: 'Children',
    items: [
      'Where2Meet is not directed at children under 13, and we do not knowingly collect their personal information. If you think a child has given us information, email us and we will delete it.',
    ],
  },
  {
    heading: 'Changes',
    items: ['If this policy changes, we will update this page and the date at the top.'],
  },
];

export default function PrivacyPage() {
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
        <h1 className="mb-1 text-2xl font-bold tracking-[-0.6px]">Privacy Policy</h1>
        <p className="mb-4 text-sm text-[#666b73]">Last updated November 5, 2026</p>
        <div className="space-y-5 rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-sm font-semibold">{section.heading}</h2>
              <ul className="mt-1 space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-[#666b73]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section>
            <h2 className="text-sm font-semibold">Contact</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#666b73]">
              Email{' '}
              <a href="mailto:victorzhang0218@gmail.com" className="font-semibold text-[#bd3843]">
                victorzhang0218@gmail.com
              </a>{' '}
              with any question about your data.
            </p>
          </section>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/contact" className="font-medium text-[#666b73] hover:text-[#bd3843]">
            Contact
          </Link>
        </p>
      </main>
    </div>
  );
}
