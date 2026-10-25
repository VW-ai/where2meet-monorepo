import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { GuideLink, HomeGuides } from '@/features/landing/lib/home-guides';

const STEPS = [
  {
    title: 'Add where everyone starts',
    body: 'Share the link, and each person adds a cross street, station or neighborhood. The organizer can add people too.',
  },
  {
    title: 'Compare travel times on the map',
    body: "Search places around the group or by name. Open one to see each person's travel time and route on the map.",
  },
  {
    title: 'Vote and share the spot',
    body: 'Everyone votes on where to meet. The organizer picks the final spot, and everyone with the link sees it without a refresh.',
  },
];

const card = 'rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6 lg:p-7';
const heading = 'text-xl font-bold tracking-[-0.4px] lg:text-2xl';
const body = 'text-[15px] leading-relaxed text-[#666b73]';

export function HomeSections({ guides }: { guides: HomeGuides }) {
  return (
    <div className="mt-10 space-y-10 lg:space-y-12" data-leave="0">
      <section aria-labelledby="home-what" className={card}>
        <h2 id="home-what" className={heading}>
          A group meetup planner with real travel times
        </h2>
        <p className={`mt-2 max-w-3xl ${body}`}>
          Where2Meet is a free group planning app for deciding where to meet. Everyone adds where
          they&apos;re coming from, and one map shows each person&apos;s real travel time by car,
          transit, walking or bike. Then the group votes on a convenient spot, and nobody has to
          sign up.
        </p>
      </section>

      <section aria-labelledby="home-steps">
        <h2 id="home-steps" className={heading}>
          Plan together in three steps
        </h2>
        <ol className="mt-4 grid gap-3 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className={card}>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0ef] text-sm font-bold text-[#bc3942]"
                >
                  {index + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
              </div>
              <p className={`mt-2 ${body}`}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="home-guides">
        <h2 id="home-guides" className={heading}>
          Guides to where to meet
        </h2>
        {/* Darker than card text, because the backdrop's color glows can pass behind it. */}
        <p className="mt-1 text-[15px] leading-relaxed text-[#3a3f46]">
          Each guide names real places that work for a group and how everyone gets there.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <GuideList heading="By city" links={guides.cities} />
          <GuideList heading="By occasion" links={guides.posts} />
        </div>
      </section>
    </div>
  );
}

function GuideList({ heading, links }: { heading: string; links: GuideLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-[#666b73]">{heading}</h3>
      <ul className="mt-1 divide-y divide-[#eef1f4]">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-11 items-center justify-between gap-3 py-2 font-medium text-[#21252b] hover:text-[#bc3942] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
            >
              {link.title}
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[#a3a8b0]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
