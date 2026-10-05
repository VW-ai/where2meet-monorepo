import { createElement } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MapPin, type IconNode } from 'lucide';
import { OCCASIONS } from '@/content/blog/posts';
import { StructuredData } from '@/components/seo/structured-data';
import { PlanCta } from '@/features/blog/ui/plan-cta';
import { Byline } from '@/features/blog/ui/post-card';
import {
  coverPath,
  hubOf,
  pageArea,
  pagePath,
  pageTrail,
  type Crumb,
  type GuidePage,
  type GuidesPage,
  type HubPage,
} from '@/features/guides/lib/catalog';
import { COVER_ALT } from '@/features/guides/lib/seo';
import { generateBlogPostingSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { proseComponents as prose } from '@/mdx-components';
import { CuratedPlaces } from './curated-places';
import { GuideMarkdown } from './guide-markdown';

/** A linked card in a list of guides, towns or cities. */
interface LinkCard {
  href: string;
  icon: IconNode;
  title: string;
  description: string;
}

const articleCard =
  'mt-6 rounded-[28px] bg-white p-5 text-base leading-[1.7] text-[#3a3f46] shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-8 sm:text-[17px]';
const sectionHeading = 'text-lg font-bold tracking-[-0.3px]';

export function GuidesPageView({ page }: { page: GuidesPage }) {
  const trail = pageTrail(page);
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema([{ name: 'Home', path: '/' }, ...trail])} />
      <Breadcrumbs trail={trail} />
      {page.kind === 'guide' ? <GuideBody page={page} /> : <HubBody page={page} />}
    </>
  );
}

function GuideBody({ page }: { page: GuidePage }) {
  const { guide } = page;
  const area = pageArea(page);
  const siblings = area.guides.filter(({ occasion }) => occasion !== guide.occasion);

  return (
    <>
      <StructuredData
        data={generateBlogPostingSchema({
          title: guide.seo.title,
          description: guide.seo.description,
          path: pagePath(page),
          coverPath: coverPath(page),
          publishedAt: guide.updatedAt,
          updatedAt: guide.updatedAt,
        })}
      />
      <article>
        <h1 className="mt-4 text-[28px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[36px]">
          {guide.seo.title}
        </h1>
        <Byline date={guide.updatedAt} prefix="Updated" className="mt-3" />
        <Image
          src={coverPath(page)}
          alt={COVER_ALT}
          width={1200}
          height={630}
          sizes="(min-width: 672px) 640px, 100vw"
          priority
          className="mt-6 aspect-[1200/630] w-full rounded-[28px] bg-white shadow-[0_4px_24px_rgba(23,37,45,0.1)]"
        />
        <div className={articleCard}>
          <GuideMarkdown source={guide.intro} />
          {guide.places.length > 0 && (
            <CuratedPlaces title={`Our picks in ${area.name}`} places={guide.places} />
          )}
          <GuideMarkdown source={guide.tips} />
        </div>
      </article>

      <PlanCta
        heading={`Plan your ${OCCASIONS[guide.occasion].label.toLowerCase()} on Where2Meet`}
      />

      <section className="mt-10">
        <h2 className={sectionHeading}>More guides for {area.name}</h2>
        <LinkCards
          cards={[
            ...siblings.map((other) =>
              guideCard({ kind: 'guide', city: page.city, town: page.town, guide: other })
            ),
            hubCard(hubOf(page), area.seo.title),
          ]}
        />
      </section>
    </>
  );
}

function HubBody({ page }: { page: HubPage }) {
  const area = pageArea(page);
  const towns = page.town ? [] : page.city.towns;

  return (
    <>
      <h1 className="mt-4 text-[28px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[36px]">
        {area.seo.title}
      </h1>
      {(area.intro || area.transitNotes) && (
        <div className={articleCard}>
          <GuideMarkdown source={area.intro} />
          {area.transitNotes && (
            <>
              <prose.h2>Getting around</prose.h2>
              <GuideMarkdown source={area.transitNotes} />
            </>
          )}
        </div>
      )}

      {area.guides.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>Guides for {area.name}</h2>
          <LinkCards
            cards={area.guides.map((guide) =>
              guideCard({ kind: 'guide', city: page.city, town: page.town, guide })
            )}
          />
        </section>
      )}

      {towns.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>Neighborhoods and towns</h2>
          <LinkCards cards={towns.map((town) => hubCard({ kind: 'hub', city: page.city, town }))} />
        </section>
      )}

      <PlanCta heading={`Plan where to meet in ${area.name}`} />
    </>
  );
}

function guideCard(page: GuidePage): LinkCard {
  const { label, icon } = OCCASIONS[page.guide.occasion];
  return { href: pagePath(page), icon, title: label, description: page.guide.seo.description };
}

/** A city on the index, a town on its city's hub, or the hub a guide belongs to. */
function hubCard(page: HubPage, title = pageArea(page).name): LinkCard {
  const area = pageArea(page);
  return { href: pagePath(page), icon: MapPin, title, description: area.seo.description };
}

function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm font-medium text-[#666b73]">
        {trail.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-[#a3a8b0]" />
            )}
            {index < trail.length - 1 ? (
              <Link href={crumb.path} className="hover:text-[#bd3843]">
                {crumb.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-[#21252b]">
                {crumb.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function LinkCards({ cards }: { cards: LinkCard[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.href}>
          <Link
            href={card.href}
            className="group flex h-full items-start gap-3 rounded-[20px] bg-white p-4 shadow-[0_2px_14px_rgba(23,37,45,0.09)] transition-shadow hover:shadow-[0_6px_22px_rgba(23,37,45,0.14)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0ef] text-[#bc3942]">
              <NodeIcon icon={card.icon} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-snug text-[#21252b] group-hover:text-[#bc3942]">
                {card.title}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[#666b73]">
                {card.description}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Draws a lucide icon from its shape data, the same data the covers use. */
function NodeIcon({ icon }: { icon: IconNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
    </svg>
  );
}
