import { createElement } from 'react';
import type { MDXContent } from 'mdx/types';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MapPin, type IconNode } from 'lucide';
import { StructuredData } from '@/components/seo/structured-data';
import {
  areaPosts,
  pagePath,
  pageTrail,
  postChips,
  postCover,
  postPath,
  postPhotos,
  relatedPosts,
  type AreaPage,
  type BlogPage,
  type Catalog,
  type City,
  type Crumb,
  type Post,
  type Term,
} from '@/features/blog/lib/catalog';
import { occasionIcon } from '@/features/blog/lib/occasion-icon';
import { generateBlogPostingSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { proseComponents as prose } from '@/mdx-components';
import { CuratedPlaces } from './curated-places';
import { PhotoFigure } from './photo-figure';
import { PlanCta } from './plan-cta';
import { Byline } from './post-card';
import { PanelBody, PostMarkdown } from './post-markdown';

interface LinkCard {
  href: string;
  icon: IconNode;
  title: string;
  chips?: readonly Term[];
  description: string;
}

const articleCard =
  'mt-6 rounded-[28px] bg-white p-5 text-base leading-[1.7] text-[#3a3f46] shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-8 sm:text-[17px]';
const heading = 'mt-4 text-[28px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[36px]';
const sectionHeading = 'text-lg font-bold tracking-[-0.3px]';
const coverImage = 'rounded-[28px] shadow-[0_4px_24px_rgba(23,37,45,0.1)]';
const coverSizes = '(min-width: 896px) 864px, 100vw';
const chip = 'rounded-full px-2.5 py-0.5 text-xs font-medium leading-5';

export function BlogPageView({
  page,
  catalog,
  Mdx,
}: {
  page: BlogPage;
  catalog: Catalog;
  Mdx?: MDXContent;
}) {
  const trail = pageTrail(page);
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema([{ name: 'Home', path: '/' }, ...trail])} />
      <Breadcrumbs trail={trail} />
      {page.kind === 'post' ? (
        <PostView post={page.post} catalog={catalog} Mdx={Mdx} />
      ) : (
        <AreaView page={page} catalog={catalog} />
      )}
    </>
  );
}

function PostView({ post, catalog, Mdx }: { post: Post; catalog: Catalog; Mdx?: MDXContent }) {
  const { source, places, placesTitle } = post;
  const related = relatedPosts(catalog, post);
  return (
    <>
      <StructuredData
        data={generateBlogPostingSchema({
          title: post.title,
          description: post.description,
          path: postPath(post),
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          images: postPhotos(post),
        })}
      />
      <article>
        <h1 className={heading}>{post.title}</h1>
        {post.areas.length > 0 && <Chips terms={postChips(post)} className="mt-3" />}
        <Byline post={post} className="mt-3" />
        <PhotoFigure
          photo={postCover(post)}
          sizes={coverSizes}
          preload
          className="mt-6"
          imageClassName={coverImage}
        />
        <div className={articleCard}>
          {source.kind === 'mdx' ? (
            Mdx && (
              <Mdx
                components={{
                  Places: () => <CuratedPlaces title={placesTitle} places={places} />,
                }}
              />
            )
          ) : (
            <PanelBody
              markdown={source.markdown}
              images={source.images}
              places={places}
              placesTitle={placesTitle}
            />
          )}
        </div>
      </article>

      <PlanCta heading={`Plan your ${post.occasion.label.toLowerCase()} on Where2Meet`} />

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>More from the blog</h2>
          <LinkCards cards={related.map(postCard)} />
        </section>
      )}
    </>
  );
}

function AreaView({ page, catalog }: { page: AreaPage; catalog: Catalog }) {
  const area = page.town ?? page.city;
  const posts = areaPosts(catalog, page);
  const towns = page.town ? [] : [...page.city.towns.values()];

  return (
    <>
      <h1 className={heading}>{area.seo.title}</h1>
      {area.image && (
        <PhotoFigure
          photo={area.image}
          sizes={coverSizes}
          preload
          className="mt-6"
          imageClassName={coverImage}
        />
      )}
      {(area.intro || area.transitNotes) && (
        <div className={articleCard}>
          <PostMarkdown source={area.intro} />
          {area.transitNotes && (
            <>
              <prose.h2>Getting around</prose.h2>
              <PostMarkdown source={area.transitNotes} />
            </>
          )}
        </div>
      )}

      {posts.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>Guides for {area.name}</h2>
          <LinkCards cards={posts.map(postCard)} />
        </section>
      )}

      {towns.length > 0 && (
        <section className="mt-10">
          <h2 className={sectionHeading}>Neighborhoods and towns</h2>
          <LinkCards
            cards={towns.map((town) => ({
              href: pagePath({ kind: 'area', city: page.city, town }),
              icon: MapPin,
              title: town.name,
              description: town.seo.description,
            }))}
          />
        </section>
      )}

      <PlanCta heading={`Plan where to meet in ${area.name}`} />
    </>
  );
}

export function postCard(post: Post): LinkCard {
  return {
    href: postPath(post),
    icon: occasionIcon(post.occasion.key),
    title: post.title,
    chips: post.areas.length > 0 ? postChips(post) : undefined,
    description: post.description,
  };
}

export function cityCard(city: City): LinkCard {
  return {
    href: pagePath({ kind: 'area', city, town: null }),
    icon: MapPin,
    title: city.name,
    description: city.seo.description,
  };
}

function Chips({ terms, className = '' }: { terms: readonly Term[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {terms.map((term, index) => (
        <li
          key={term.key}
          className={`${chip} ${
            index === 0
              ? 'bg-[#fff0ef] text-[#bc3942]'
              : 'bg-white text-[#3a3f46] ring-1 ring-inset ring-[#dfe3e8]'
          }`}
        >
          {term.label}
        </li>
      ))}
    </ul>
  );
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

export function LinkCards({ cards }: { cards: LinkCard[] }) {
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
            <div className="min-w-0">
              <span className="block font-semibold leading-snug text-[#21252b] group-hover:text-[#bc3942]">
                {card.title}
              </span>
              {card.chips && <Chips terms={card.chips} className="my-2" />}
              <span className="mt-1 block text-sm leading-relaxed text-[#666b73]">
                {card.description}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NodeIcon({ icon, size = 20 }: { icon: IconNode; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
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
