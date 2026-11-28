'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Star, X } from 'lucide-react';
import { fetchPlaces } from '@/features/blog/lib/google-places';
import { formatRating, type Credit, type PlaceSummary } from '@/features/blog/lib/places';
import { planHref } from '@/features/landing/model/plan-seed';
import { directionsUrl, themeSource, type LiveTheme, type ThemePlace } from '../model/themes';
import { ThemeIcon } from './icons';

const focusRing =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]';

/** Google's details by place ID, kept for the visit so reopening a card shows them at once. */
const details = new Map<string, PlaceSummary | null>();

/**
 * Direction A: on a phone the sheet slides up from the bottom; on a desktop it floats
 * at the bottom left. It never covers the whole map.
 */
function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <section
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[78svh] overflow-y-auto overscroll-contain rounded-t-[24px] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(20,30,40,0.18)] transition-transform duration-300 [transition-timing-function:cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none md:bottom-4 md:left-4 md:right-auto md:max-h-[calc(100svh-9rem)] md:w-[380px] md:rounded-[24px]"
      style={{ transform: shown ? 'none' : 'translateY(105%)' }}
    >
      <div
        aria-hidden="true"
        className="mx-auto mt-2 h-[5px] w-10 rounded-full bg-[#d5d8dc] md:hidden"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={`absolute right-3 top-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/90 text-[var(--ink)] shadow-[0_1px_4px_rgba(20,30,40,0.18)] ${focusRing}`}
      >
        <X size={18} aria-hidden="true" />
      </button>
      {children}
    </section>
  );
}

export function PlaceSheet({
  theme,
  place,
  onClose,
}: {
  theme: LiveTheme;
  place: ThemePlace;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<PlaceSummary | null | 'loading'>(
    details.has(place.placeId) ? details.get(place.placeId)! : 'loading'
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    if (details.has(place.placeId)) {
      setSummary(details.get(place.placeId)!);
      return;
    }
    setSummary('loading');
    let active = true;
    fetchPlaces([place.placeId])
      .catch(() => new Map<string, PlaceSummary>())
      .then((found) => {
        const result = found.get(place.placeId) ?? null;
        details.set(place.placeId, result);
        if (active) setSummary(result);
      });
    return () => {
      active = false;
    };
  }, [place.placeId]);

  const facts = summary !== 'loading' && summary ? summary : null;
  return (
    <Sheet label={place.label} onClose={onClose}>
      <div className="grid gap-3 px-4 pb-5 pt-3 md:pt-4">
        <Photo summary={summary} />
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="pr-8 font-bold leading-[1.12] text-balance focus:outline-none"
            style={{ fontFamily: 'var(--display)', fontSize: 'calc(23px * var(--display-scale))' }}
          >
            {place.label}
          </h2>
          {facts ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-[var(--muted)]">
              {facts.rating && (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--ink)]">
                  <Star size={13} aria-hidden="true" className="fill-[#e8a13a] text-[#e8a13a]" />
                  <span className="sr-only">Rated </span>
                  {formatRating(facts.rating)}
                </span>
              )}
              {facts.address && <span className="truncate">{facts.address}</span>}
            </p>
          ) : (
            summary === 'loading' && (
              <div aria-hidden="true" className="mt-2 h-3 w-1/2 rounded-full bg-[#eef1f4]" />
            )
          )}
        </div>
        <p className="text-[15px] leading-relaxed">{place.note}</p>
        <Link
          href={planHref({ title: place.label, placeId: place.placeId, src: themeSource(theme) })}
          className={`mt-1 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-center text-[15px] font-semibold text-[var(--accent-ink)] transition-[filter] hover:brightness-95 ${focusRing}`}
        >
          Plan with friends in Where2Meet
        </Link>
        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[#f1f2f4] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[#e8eaed] ${focusRing}`}
        >
          <Navigation size={15} aria-hidden="true" />
          Directions
          <span className="sr-only"> (opens Google Maps in a new tab)</span>
        </a>
      </div>
    </Sheet>
  );
}

function Photo({ summary }: { summary: PlaceSummary | null | 'loading' }) {
  const photo = summary !== 'loading' ? summary?.photo : null;
  return (
    <div className="relative h-[150px] overflow-hidden rounded-2xl bg-[var(--soft)] md:h-[170px]">
      {photo ? (
        <>
          {/* A plain img on purpose: Next's optimizer would cache Google's photo. */}
          <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {photo.credits.length > 0 && <PhotoCredits credits={photo.credits} />}
        </>
      ) : (
        summary !== 'loading' && (
          <MapPin
            size={28}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--muted)] opacity-50"
          />
        )
      )}
    </div>
  );
}

function PhotoCredits({ credits }: { credits: Credit[] }) {
  return (
    <p className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-lg bg-black/55 px-2 py-0.5 text-[11px] leading-4 text-white">
      Photo:{' '}
      {credits.map((credit, index) => (
        <span key={`${credit.name}-${index}`}>
          {index > 0 && ', '}
          {credit.url ? (
            <a
              href={credit.url}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-2"
            >
              {credit.name}
            </a>
          ) : (
            credit.name
          )}
        </span>
      ))}
    </p>
  );
}

/**
 * Every place in the theme. It renders on the server, hidden until the List button
 * opens it, so search engines read the whole list while people use the map.
 */
export function ListSheet({
  theme,
  open,
  onClose,
  onSelect,
}: {
  theme: LiveTheme;
  open: boolean;
  onClose: () => void;
  onSelect: (place: ThemePlace) => void;
}) {
  const list = (
    <div className="px-2 pb-4 pt-3 md:pt-4">
      <h2 className="px-3 pb-1 pr-12 text-[17px] font-bold">{theme.places.length} places</h2>
      <ul className="grid gap-0.5">
        {theme.places.map((place) => (
          <li key={place.placeId}>
            <button
              type="button"
              onClick={() => onSelect(place)}
              className={`grid w-full cursor-pointer grid-cols-[30px_minmax(0,1fr)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-[var(--soft)] ${focusRing}`}
            >
              <ThemeIcon
                name={theme.marker}
                fill={theme.palette.pin}
                detail={theme.palette.pinDetail}
                className="h-[30px] w-[30px]"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-snug">{place.label}</span>
                <span className="line-clamp-2 block text-[13px] leading-snug text-[var(--muted)]">
                  {place.note}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {theme.aside && (
        <p className="mx-3 mt-3 border-t border-[#eceef1] pt-3 text-[13px] leading-relaxed text-[var(--muted)]">
          {theme.aside.text}{' '}
          {theme.aside.links.map((link, index) => (
            <span key={link.url}>
              {index > 0 && ' or '}
              <a
                href={link.url}
                target="_blank"
                rel="noopener"
                className="font-semibold text-[var(--ink)] underline underline-offset-2"
              >
                {link.label}
              </a>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
  return open ? (
    <Sheet label={`${theme.title}, list`} onClose={onClose}>
      {list}
    </Sheet>
  ) : (
    <div hidden>{list}</div>
  );
}
