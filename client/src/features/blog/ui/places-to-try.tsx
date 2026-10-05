'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, RotateCw, Search, X } from 'lucide-react';
import { OCCASIONS, type Occasion } from '@/content/blog/posts';
import { findCity, searchPlaces } from '@/features/blog/lib/google-places';
import { createIntents } from '@/features/blog/lib/latest-intent';
import {
  dataProviders,
  describeResults,
  type PlaceSummary,
  type SearchArea,
} from '@/features/blog/lib/places';
import {
  PlaceCard,
  PlaceFacts,
  PlacesCredits,
  SkeletonCard,
  cardList,
  cardShadow,
  focusRing,
} from '@/features/blog/ui/place-card';
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
const LOAD_FAILED = "We couldn't load places right now.";

const pillButton = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-[#21252b] shadow-[0_2px_10px_rgba(23,37,45,0.08)] transition-colors hover:text-[#bc3942] aria-disabled:opacity-60 ${focusRing}`;
const accentButton = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#c83f49] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#b73540] aria-disabled:opacity-60 ${focusRing}`;

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
  const headingRef = useRef<HTMLHeadingElement>(null);
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
    headingRef.current?.focus();
    beginAction(null);
    void show(area);
  }

  const announcement =
    view.status === 'ready'
      ? describeResults(view.places.length, view.area.near)
      : view.status === 'failed'
        ? LOAD_FAILED
        : '';

  const providers = view.status === 'ready' ? dataProviders(view.places) : [];

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
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="text-lg font-bold leading-snug tracking-[-0.3px] text-[#21252b] outline-none sm:text-xl"
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
      <p role="status" className="text-sm text-[#666b73]">
        {notice ? (
          <span className="mt-2 block">{notice}</span>
        ) : (
          <span className="sr-only">{announcement}</span>
        )}
      </p>

      <Results view={view} onRetry={retry} />

      <PlacesCredits providers={providers} />
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
          <p>{LOAD_FAILED}</p>
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
            <PlaceCard
              key={place.id}
              title={place.name}
              titleAs="h4"
              href={place.mapsUrl}
              photo={place.photo}
            >
              <PlaceFacts place={place} />
            </PlaceCard>
          ))}
        </ul>
      ) : (
        <Message>
          <p>{describeResults(0, view.area.near)} Try another city.</p>
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
