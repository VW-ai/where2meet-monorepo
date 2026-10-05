import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { MapPin, Star } from 'lucide-react';
import { formatRating, type Credit, type PlaceSummary } from '@/features/blog/lib/places';

export const focusRing =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]';
export const cardShadow = 'shadow-[0_2px_14px_rgba(23,37,45,0.09)]';
/** Phones scroll sideways through ~80%-wide cards; wider screens get a 3-column grid. */
export const cardList =
  'no-scrollbar -mx-5 -my-3 mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-3 sm:mx-0 sm:my-0 sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:p-0';
const cardItem = `relative w-[80%] shrink-0 snap-start overflow-hidden rounded-[20px] bg-white sm:w-auto ${cardShadow}`;
const shimmer =
  'after:absolute after:inset-0 after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.6)_50%,transparent_80%)] motion-safe:after:animate-shimmer';

/** Google's photo for a card, `loading` until Google answers, or null when it has none. */
export type CardPhoto = PlaceSummary['photo'] | 'loading';

/**
 * A place card: the photo, then `title` and `children`. With `href` the whole card
 * opens the place in Google Maps.
 */
export function PlaceCard({
  title,
  titleAs: Title,
  href,
  photo,
  children,
}: {
  title: string;
  titleAs: 'h3' | 'h4';
  href: string | null;
  photo: CardPhoto;
  children: ReactNode;
}) {
  return (
    <li
      className={clsx(
        'group flex flex-col transition-shadow',
        href && 'hover:shadow-[0_6px_22px_rgba(23,37,45,0.14)]',
        cardItem
      )}
    >
      <div
        className={clsx(
          'relative aspect-[4/3] bg-[#e6e9ed]',
          photo === 'loading' && ['overflow-hidden', shimmer]
        )}
      >
        {photo === 'loading' ? null : photo ? (
          <>
            {/* A plain img on purpose: Next's optimizer would cache Google's photo. */}
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {photo.credits.length > 0 && <PhotoCredits credits={photo.credits} />}
          </>
        ) : (
          <MapPin
            size={28}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#b6bcc4]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3.5">
        <Title
          className={clsx(
            'mb-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[#21252b]',
            href && 'group-hover:text-[#bc3942]'
          )}
        >
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener"
              className="after:absolute after:inset-0 after:rounded-[20px] focus:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[#b73540]"
            >
              {title}
              <span className="sr-only"> (opens Google Maps in a new tab)</span>
            </a>
          ) : (
            title
          )}
        </Title>
        {children}
      </div>
    </li>
  );
}

/** Google's type, rating and short address for a place. */
export function PlaceFacts({ place }: { place: PlaceSummary }) {
  return (
    <>
      {place.type && <p className="truncate text-[13px] leading-5 text-[#666b73]">{place.type}</p>}
      {place.rating && (
        <p className="flex items-center gap-1 text-[13px] font-medium leading-5 text-[#3a3f46]">
          <Star size={13} aria-hidden="true" className="fill-[#e8a13a] text-[#e8a13a]" />
          <span className="sr-only">Rated </span>
          {formatRating(place.rating)}
        </p>
      )}
      {place.address && (
        <p className="truncate text-[13px] leading-5 text-[#666b73]">{place.address}</p>
      )}
    </>
  );
}

/** Two bars standing in for `PlaceFacts` until Google answers. */
export function PlaceFactsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2 py-1">
      <div className="h-3 w-1/2 rounded-full bg-[#eef1f4]" />
      <div className="h-3 w-2/3 rounded-full bg-[#eef1f4]" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <li aria-hidden="true" className={`${shimmer} ${cardItem}`}>
      <div className="aspect-[4/3] bg-[#e6e9ed]" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-3/4 rounded-full bg-[#e6e9ed]" />
        <div className="h-3 w-1/2 rounded-full bg-[#eef1f4]" />
        <div className="h-3 w-2/3 rounded-full bg-[#eef1f4]" />
      </div>
    </li>
  );
}

/** The credits Google requires under its places: third-party data providers and Google Maps. */
export function PlacesCredits({ providers }: { providers: Credit[] }) {
  return (
    <div className="mt-4 flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-xs text-[#5e5e5e]">
      {providers.length > 0 && (
        <p>
          Data from <CreditLinks credits={providers} />
        </p>
      )}
      <p translate="no" className="font-[Roboto,Arial,sans-serif]">
        Google Maps
      </p>
    </div>
  );
}

function PhotoCredits({ credits }: { credits: Credit[] }) {
  return (
    <p className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] whitespace-normal rounded-lg bg-black/55 px-2 py-0.5 text-[11px] leading-4 text-white">
      Photo: <CreditLinks credits={credits} />
    </p>
  );
}

function CreditLinks({ credits }: { credits: Credit[] }) {
  return credits.map((credit, index) => (
    <span key={`${credit.name}-${index}`}>
      {index > 0 && ', '}
      {credit.url ? (
        <a
          href={credit.url}
          target="_blank"
          rel="noopener"
          className="underline decoration-current/40 underline-offset-2 hover:decoration-current focus:outline-none focus-visible:decoration-current"
        >
          {credit.name}
        </a>
      ) : (
        credit.name
      )}
    </span>
  ));
}
