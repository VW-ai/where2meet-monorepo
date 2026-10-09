'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { fetchPlaces } from '@/features/blog/lib/google-places';
import { dataProviders, type PlaceSummary } from '@/features/blog/lib/places';
import {
  PlaceCard,
  PlaceFacts,
  PlaceFactsSkeleton,
  PlacesCredits,
  cardList,
} from '@/features/blog/ui/place-card';
import type { CuratedPlace } from '@/features/blog/lib/catalog';

/** Google's details by place ID once it answers. A missing ID means Google had nothing. */
type Lookup = { status: 'waiting' } | { status: 'done'; found: ReadonlyMap<string, PlaceSummary> };

/**
 * The editor's picks for a post. Labels and notes render on the server; each card's
 * photo, type, rating, address and Maps link load live from Google near the viewport
 * and are never stored, per Google's terms.
 */
export function CuratedPlaces({
  title,
  places,
}: {
  title: string;
  places: readonly CuratedPlace[];
}) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const [lookup, setLookup] = useState<Lookup>({ status: 'waiting' });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let mounted = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fetchPlaces(places.map((place) => place.placeId))
          .catch((error) => {
            console.error('[CuratedPlaces] Google Maps failed:', error);
            return new Map<string, PlaceSummary>();
          })
          .then((found) => mounted && setLookup({ status: 'done', found }));
      },
      { rootMargin: '200px' }
    );
    observer.observe(section);
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [places]);

  const found = lookup.status === 'done' ? lookup.found : null;
  const shown = found ? places.flatMap((place) => found.get(place.placeId) ?? []) : [];

  return (
    // Bleeds to the edges of the post's card, which pads its body with p-5 sm:p-8.
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="-mx-5 my-8 bg-[#f4f6f8] px-5 py-6 sm:-mx-8 sm:px-8 sm:py-7"
    >
      <h2
        id={headingId}
        className="text-lg font-bold leading-snug tracking-[-0.3px] text-[#21252b] sm:text-xl"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[#666b73]">
        Chosen by the Where2Meet team. Photos, ratings and addresses load live from Google Maps.
      </p>
      <ul className={cardList}>
        {places.map((place) => {
          const details = found?.get(place.placeId) ?? null;
          return (
            <PlaceCard
              key={place.placeId}
              title={place.label}
              titleAs="h3"
              href={details?.mapsUrl ?? null}
              photo={found ? (details?.photo ?? null) : 'loading'}
            >
              {details ? <PlaceFacts place={details} /> : !found && <PlaceFactsSkeleton />}
              {place.note && (
                <p className="mt-2 text-sm leading-relaxed text-[#3a3f46]">{place.note}</p>
              )}
            </PlaceCard>
          );
        })}
      </ul>
      <PlacesCredits providers={dataProviders(shown)} />
    </section>
  );
}
