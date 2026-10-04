'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, MapPin, RotateCw, Search, Star, X } from 'lucide-react';
import { OCCASIONS, type Occasion } from '@/content/blog/posts';
import { findCity, searchPlaces } from '@/features/blog/lib/google-places';
import { createIntents } from '@/features/blog/lib/latest-intent';
import {
  formatRating,
  type PhotoCredit,
  type PlaceSummary,
  type SearchArea,
} from '@/features/blog/lib/places';
import { parseVisitorGeo } from '@/shared/lib/visitor-geo';
import type { Location } from '@/shared/types/map';

type View =
  | { status: 'waiting' }
  | { status: 'loading'; area: SearchArea | null }
  | { status: 'ready'; area: SearchArea; places: PlaceSummary[] }
  | { status: 'failed'; area: SearchArea | null };

/** The control that is turning the reader's input into a search area. */
type Pending = 'city' | 'location' | null;

/** `closed` differs from `unused` so focus returns to "Change city" after the form closes. */
type CityForm = 'unused' | 'open' | 'closed';

const SKELETON_COUNT = 6;

const focusRing =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]';
const pillButton = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-[#21252b] shadow-[0_2px_10px_rgba(23,37,45,0.08)] transition-colors hover:text-[#bc3942] aria-disabled:opacity-60 ${focusRing}`;
const accentButton = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#c83f49] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#b73540] aria-disabled:opacity-60 ${focusRing}`;
const cardShadow = 'shadow-[0_2px_14px_rgba(23,37,45,0.09)]';
/** Phones scroll sideways through ~80%-wide cards; wider screens get a 3-column grid. */
const cardList =
  'no-scrollbar -mx-5 -my-3 mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-3 sm:mx-0 sm:my-0 sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:p-0';
const cardItem = `relative w-[80%] shrink-0 snap-start overflow-hidden rounded-[20px] bg-white sm:w-auto ${cardShadow}`;

async function fetchVisitorArea(): Promise<SearchArea> {
  const response = await fetch('/api/geo');
  if (!response.ok) throw new Error(`GET /api/geo returned ${response.status}`);
  const { city, lat, lng } = parseVisitorGeo(await response.json());
  return { near: city, center: { lat, lng } };
}

/** Covers time the browser's permission prompt stays open, which `timeout` doesn't count. */
const LOCATION_DEADLINE_MS = 20_000;

function currentPosition(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is unavailable'));
      return;
    }
    setTimeout(() => reject(new Error('Timed out waiting for a location')), LOCATION_DEADLINE_MS);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      reject,
      { timeout: 10_000, maximumAge: 600_000 }
    );
  });
}

/**
 * Live Google Maps suggestions for a post's occasion near the reader. Google's terms
 * forbid storing place photos and details, so nothing here is cached or prerendered.
 */
export function PlacesToTry({ occasion }: { occasion: Occasion }) {
  const { label, placeQueries } = OCCASIONS[occasion];
  const headingId = useId();
  const cityInputId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  /** The newest reader action owns `pending` and `notice`, and may start a search. */
  const [claimAction] = useState(createIntents);
  /** The newest search owns `view`; an action that ends without one leaves it alone. */
  const [claimSearch] = useState(createIntents);
  const [view, setView] = useState<View>({ status: 'waiting' });
  const [cityForm, setCityForm] = useState<CityForm>('unused');
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const show = useCallback(
    async (area: SearchArea | null) => {
      const isCurrent = claimSearch();
      let resolved = area;
      setView({ status: 'loading', area });
      try {
        resolved ??= await fetchVisitorArea();
        if (!isCurrent()) return;
        setView({ status: 'loading', area: resolved });
        const places = await searchPlaces(resolved, placeQueries);
        if (isCurrent()) setView({ status: 'ready', area: resolved, places });
      } catch (error) {
        console.error('[PlacesToTry] Search failed:', error);
        if (isCurrent()) setView({ status: 'failed', area: resolved });
      }
    },
    [claimSearch, placeQueries]
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void show(null);
      },
      { rootMargin: '200px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [show]);

  function beginAction(busy: Pending) {
    const isCurrent = claimAction();
    setPending(busy);
    setNotice(null);
    return isCurrent;
  }

  async function submitCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('city') ?? '').trim();
    if (!query || pending === 'city') return;
    const isCurrent = beginAction('city');
    try {
      const area = await findCity(query);
      if (!isCurrent()) return;
      if (area) {
        setCityForm('closed');
        void show(area);
      } else {
        setNotice(`We couldn't find "${query}". Try another city.`);
      }
    } catch (error) {
      console.error('[PlacesToTry] City lookup failed:', error);
      if (isCurrent()) setNotice("We couldn't look up that city. Try again.");
    } finally {
      if (isCurrent()) setPending(null);
    }
  }

  async function showNearReader() {
    if (pending === 'location') return;
    const isCurrent = beginAction('location');
    try {
      const center = await currentPosition();
      if (isCurrent()) void show({ near: 'you', center });
    } catch {
      if (isCurrent()) setNotice("We couldn't get your location. You can change the city instead.");
    } finally {
      if (isCurrent()) setPending(null);
    }
  }

  const area = view.status === 'waiting' ? null : view.area;

  function retry() {
    beginAction(null);
    void show(area);
  }

  function closeCityForm() {
    setCityForm('closed');
    setNotice(null);
  }

  return (
    // Bleeds to the edges of the post's card, which pads its body with p-5 sm:p-8.
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="-mx-5 my-8 bg-[#f4f6f8] px-5 py-6 sm:-mx-8 sm:px-8 sm:py-7"
    >
      <h3
        id={headingId}
        className="text-lg font-bold leading-snug tracking-[-0.3px] text-[#21252b] sm:text-xl"
      >
        {area ? `Places to try near ${area.near}` : 'Places to try'}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[#666b73]">
        Live suggestions from Google Maps for a {label.toLowerCase()}.
      </p>

      {cityForm === 'open' ? (
        <form onSubmit={submitCity} className="mt-4 flex gap-2">
          <label htmlFor={cityInputId} className="sr-only">
            City
          </label>
          <input
            id={cityInputId}
            name="city"
            type="text"
            required
            autoFocus
            autoComplete="address-level2"
            placeholder="Enter a city"
            onKeyDown={(event) => event.key === 'Escape' && closeCityForm()}
            className={`min-h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-base text-[#21252b] shadow-[0_2px_10px_rgba(23,37,45,0.08)] placeholder:text-[#8a9099] sm:text-sm ${focusRing}`}
          />
          <button type="submit" aria-disabled={pending === 'city'} className={accentButton}>
            {pending === 'city' ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            aria-label="Cancel"
            onClick={closeCityForm}
            className={`${pillButton} w-10 px-0`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            autoFocus={cityForm === 'closed'}
            onClick={() => setCityForm('open')}
            className={pillButton}
          >
            <Search size={15} aria-hidden="true" />
            Change city
          </button>
          <button
            type="button"
            onClick={showNearReader}
            aria-disabled={pending === 'location'}
            className={pillButton}
          >
            <LocateFixed size={15} aria-hidden="true" />
            {pending === 'location' ? 'Locating…' : 'Use my location'}
          </button>
        </div>
      )}
      <p role="status" className="mt-2 text-sm text-[#666b73] empty:mt-0">
        {notice}
      </p>

      <Results view={view} onRetry={retry} />

      <p
        translate="no"
        className="mt-4 text-right font-[Roboto,Arial,sans-serif] text-xs text-[#5e5e5e]"
      >
        Google Maps
      </p>
    </section>
  );
}

function Results({ view, onRetry }: { view: View; onRetry: () => void }) {
  switch (view.status) {
    case 'waiting':
    case 'loading':
      return (
        <ul aria-busy="true" aria-label="Loading places" className={cardList}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </ul>
      );
    case 'failed':
      return (
        <Message>
          <p>We couldn&apos;t load places right now.</p>
          <button type="button" onClick={onRetry} className={`${accentButton} mt-3`}>
            <RotateCw size={15} aria-hidden="true" />
            Try again
          </button>
        </Message>
      );
    case 'ready':
      return view.places.length > 0 ? (
        <ul className={cardList}>
          {view.places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </ul>
      ) : (
        <Message>
          <p>No places came up near {view.area.near}. Try another city.</p>
        </Message>
      );
  }
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`mt-4 rounded-[20px] bg-white px-5 py-8 text-center text-sm text-[#3a3f46] ${cardShadow}`}
    >
      {children}
    </div>
  );
}

function PlaceCard({ place }: { place: PlaceSummary }) {
  return (
    <li
      className={`group flex flex-col transition-shadow hover:shadow-[0_6px_22px_rgba(23,37,45,0.14)] ${cardItem}`}
    >
      <div className="relative aspect-[4/3] bg-[#e6e9ed]">
        {place.photo ? (
          <>
            {/* A plain img on purpose: Next's optimizer would cache Google's photo. */}
            <img
              src={place.photo.url}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {place.photo.credits.length > 0 && <PhotoCredits credits={place.photo.credits} />}
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
        <h4 className="mb-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[#21252b] group-hover:text-[#bc3942]">
          <a
            href={place.mapsUrl}
            target="_blank"
            rel="noopener"
            className="after:absolute after:inset-0 after:rounded-[20px] focus:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[#b73540]"
          >
            {place.name}
            <span className="sr-only"> (opens Google Maps in a new tab)</span>
          </a>
        </h4>
        {place.type && (
          <p className="truncate text-[13px] leading-5 text-[#666b73]">{place.type}</p>
        )}
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
      </div>
    </li>
  );
}

function PhotoCredits({ credits }: { credits: PhotoCredit[] }) {
  return (
    <p className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] leading-4 text-white">
      Photo:{' '}
      {credits.map((credit, index) => (
        <span key={`${credit.name}-${index}`}>
          {index > 0 && ', '}
          {credit.url ? (
            <a
              href={credit.url}
              target="_blank"
              rel="noopener"
              className="underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
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

function SkeletonCard() {
  return (
    <li
      aria-hidden="true"
      className={`after:absolute after:inset-0 after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.6)_50%,transparent_80%)] motion-safe:after:animate-shimmer ${cardItem}`}
    >
      <div className="aspect-[4/3] bg-[#e6e9ed]" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-3/4 rounded-full bg-[#e6e9ed]" />
        <div className="h-3 w-1/2 rounded-full bg-[#eef1f4]" />
        <div className="h-3 w-2/3 rounded-full bg-[#eef1f4]" />
      </div>
    </li>
  );
}
