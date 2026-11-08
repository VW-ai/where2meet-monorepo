'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { Check, Coffee, Heart, Navigation, Search, Utensils, Wine, X } from 'lucide-react';
import type { Participant, Venue } from '@/entities';
import catLogo from '@/components/cat/logo.svg';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { hasStartingPoint, personRouteKeys } from '@/features/meeting/lib/person-routes';
import { formatTripTime, slowestRoute } from '@/features/meeting/lib/route-summary';
import { slideLocks, slideOffset } from '@/features/meeting/lib/slide-to-lock';
import {
  CATEGORY_QUERY,
  avatarTint,
  whenShort,
  type PlaceCategory,
} from '@/features/meeting/lib/phone-plan';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { phonePlan, usePhonePlanStore } from '@/features/meeting/model/phone-plan-store';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { venueMapsUrl } from '@/shared/lib/map-provider';
import { ModePicker, useParticipantRights } from '../sidebar/transport-parts';
import { Avatar, AvatarStack, Cta } from './phone-parts';

const messages = defineMessages({
  en: {
    all: 'All',
    coffee: 'Coffee',
    food: 'Food',
    drinks: 'Drinks',
    searchPlaces: 'Search places',
    closeSearch: 'Close search',
    open: 'Search',
    count: (n: number) => `${n} ${n === 1 ? 'place' : 'places'} · most liked first`,
    within: (minutes: number) => `Everyone within ${minutes} min`,
    withinShort: (minutes: number) => `Within ${minutes} min`,
    joinTrips: 'Join to see trip times',
    findingTrips: 'Finding trip times',
    finding: 'Finding places',
    empty: 'Nothing here yet. Try a bigger area or another search.',
    failed: "Couldn't load places.",
    retry: 'Try again',
    like: (name: string) => `Like ${name}`,
    unlike: (name: string) => `Remove like from ${name}`,
    needStart: 'Add your start first, then you can like places.',
    seeOnMap: 'See on map',
    directions: 'Directions',
    slide: (name: string) => `Slide to lock in ${name}`,
    lock: (name: string) => `Lock in ${name}`,
    lockedFor: (when: string) => `Locked in for ${when}`,
    lockedIn: 'Locked in',
    changePlace: 'Change place',
    reopened: (name: string) => `${name} reopened for the group`,
    showTicket: 'Show the ticket',
    you: 'You',
  },
  zh: {
    all: '全部',
    coffee: '咖啡',
    food: '美食',
    drinks: '小酌',
    searchPlaces: '搜索地点',
    closeSearch: '关闭搜索',
    open: '搜索',
    count: (n: number) => `${n} 个地点 · 喜欢多的在前`,
    within: (minutes: number) => `所有人 ${minutes} 分钟内可到`,
    withinShort: (minutes: number) => `${minutes} 分钟内`,
    joinTrips: '加入后可看路程时间',
    findingTrips: '正在计算路程',
    finding: '正在找地点',
    empty: '这里还没有结果。试试扩大范围或换个搜索。',
    failed: '地点没能加载。',
    retry: '重试',
    like: (name: string) => `喜欢${name}`,
    unlike: (name: string) => `取消喜欢${name}`,
    needStart: '先填写你的出发地，才能喜欢地点。',
    seeOnMap: '在地图上看',
    directions: '导航',
    slide: (name: string) => `滑动，就定${name}`,
    lock: (name: string) => `就定${name}`,
    lockedFor: (when: string) => `已定：${when}`,
    lockedIn: '已确定',
    changePlace: '更换地点',
    reopened: (name: string) => `${name}已重新开放给大家`,
    showTicket: '查看票面',
    you: '我',
  },
});

const CATEGORIES: ReadonlyArray<{ id: PlaceCategory; icon?: typeof Coffee }> = [
  { id: 'all' },
  { id: 'coffee', icon: Coffee },
  { id: 'food', icon: Utensils },
  { id: 'drinks', icon: Wine },
];

interface Trip {
  person: Participant;
  seconds: number;
}

/** A venue's trips: the live routes for the selected one, or what the cache remembers for others. */
function useTrips(venue: Venue | null) {
  const participants = useMeetingStore((state) => state.currentEvent?.participants);
  const selectedId = useMeetingStore((state) => state.selectedVenue?.id);
  const routes = useMapStore((state) => state.routes);
  const entries = useRouteCacheStore((state) => state.entries);
  const hasToken = useAuthStore((state) => !!(state.organizerToken || state.participantToken));
  const located = (participants ?? []).filter(hasStartingPoint);
  if (!venue || !hasToken) return { trips: [] as Trip[], status: 'join' as const };
  const keys = personRouteKeys(venue.id, located);
  const trips = located.flatMap((person): Trip[] => {
    const live = venue.id === selectedId && routes.find((r) => r.participantId === person.id);
    if (live) return [{ person, seconds: live.durationSeconds }];
    const key = keys.get(person.id);
    const cached = key ? entries[key] : undefined;
    return cached?.status === 'found' ? [{ person, seconds: cached.route.durationSeconds }] : [];
  });
  return {
    trips,
    status:
      trips.length >= located.length && trips.length > 0
        ? ('ready' as const)
        : ('finding' as const),
  };
}

const minutesOf = (seconds: number) => Math.max(1, Math.round(seconds / 60));

function useMyId() {
  return useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);
}

function useLikers(venueId: string) {
  const voterIds = useVotingStore((state) => state.voteStatsByVenueId[venueId]?.voterIds);
  const participants = useMeetingStore((state) => state.currentEvent?.participants);
  return (participants ?? []).filter((person) => voterIds?.includes(person.id));
}

export function VenueTile({ venue, size }: { venue: Venue; size: number }) {
  return (
    <span className="pp-tile" style={{ width: size, height: size }}>
      {venue.photoUrl && <img src={venue.photoUrl} alt="" loading="lazy" />}
    </span>
  );
}

function LikeButton({ venue, size }: { venue: Venue; size: number }) {
  const t = useMessages(messages);
  const liked = useVotingStore((state) => state.hasVotedFor(venue.id));
  return (
    <button
      type="button"
      className="pp-heart"
      data-liked={liked || undefined}
      aria-pressed={liked}
      aria-label={liked ? t.unlike(venue.name) : t.like(venue.name)}
      style={{ width: size, height: size }}
      onClick={(event) => {
        event.stopPropagation();
        void phonePlan.toggleLike(venue, t.needStart);
      }}
    >
      <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}

function metaLine(venue: Venue) {
  return venue.rating != null ? `★ ${venue.rating.toFixed(1)}` : null;
}

function TripChips({ venue }: { venue: Venue }) {
  const t = useMessages(messages);
  const { trips, status } = useTrips(venue);
  const myId = useMyId();
  const likers = useLikers(venue.id);
  const slowest = slowestRoute(trips.map((trip) => ({ ...trip, durationSeconds: trip.seconds })));
  return (
    <>
      {trips.length > 0 && (
        <div className="pp-chips-trips">
          {trips.map((trip) => (
            <span
              key={trip.person.id}
              className={cn('pp-trip-chip', trip.person.id === slowest?.person.id && 'pp-slowest')}
            >
              <Avatar person={trip.person} size={22} isYou={trip.person.id === myId} />
              {minutesOf(trip.seconds)}m
            </span>
          ))}
        </div>
      )}
      <div className="pp-card-foot">
        <span>
          {status === 'join'
            ? t.joinTrips
            : status === 'finding'
              ? t.findingTrips
              : t.within(minutesOf(slowest?.seconds ?? 0))}
        </span>
        <AvatarStack people={likers} size={22} max={4} myId={myId} />
      </div>
    </>
  );
}

function VenueCard({ venue, current }: { venue: Venue; current: boolean }) {
  const t = useMessages(messages);
  const lastTap = useRef(0);
  const [burst, setBurst] = useState(false);
  const liked = useVotingStore((state) => state.hasVotedFor(venue.id));
  const meta = metaLine(venue);

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
      if (!liked) void phonePlan.toggleLike(venue, t.needStart);
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current !== now) return;
      if (current) {
        usePhonePlanStore.setState({ expandedVenueId: venue.id, detent: 'mid' });
      } else {
        useMeetingStore.getState().setSelectedVenue(venue);
      }
    }, 320);
  };

  return (
    <article
      className="pp-card"
      data-current={current || undefined}
      data-venue={venue.id}
      onClick={tap}
    >
      <div className="pp-card-top">
        <VenueTile venue={venue} size={50} />
        <div className="pp-card-text">
          <h3>{venue.name}</h3>
          <p>
            {meta && `${meta} · `}
            {venue.address}
          </p>
        </div>
      </div>
      <LikeButton venue={venue} size={48} />
      <TripChips venue={venue} />
      {burst && (
        <span className="pp-burst" aria-hidden="true">
          <Heart fill="currentColor" />
        </span>
      )}
    </article>
  );
}

function Carousel({ venues }: { venues: readonly Venue[] }) {
  const selectedId = useMeetingStore((state) => state.selectedVenue?.id);
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const programmatic = useRef(false);

  useEffect(() => {
    const element = scroller.current;
    const card = element?.querySelector<HTMLElement>(
      `[data-venue="${CSS.escape(selectedId ?? '')}"]`
    );
    if (!element || !card) return;
    programmatic.current = true;
    element.scrollTo({ left: card.offsetLeft - 22, behavior: 'smooth' });
    setTimeout(() => {
      programmatic.current = false;
    }, 500);
  }, [selectedId]);

  const scrolled = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const element = scroller.current;
      if (!element || programmatic.current) return;
      const middle = element.scrollLeft + element.clientWidth / 2;
      const cards = [...element.querySelectorAll<HTMLElement>('[data-venue]')];
      const nearest = cards.reduce<HTMLElement | null>(
        (best, card) =>
          !best ||
          Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) <
            Math.abs(best.offsetLeft + best.offsetWidth / 2 - middle)
            ? card
            : best,
        null
      );
      const venue = venues.find((candidate) => candidate.id === nearest?.dataset.venue);
      if (venue && venue.id !== useMeetingStore.getState().selectedVenue?.id) {
        useMeetingStore.getState().setSelectedVenue(venue);
      }
    }, 110);
  };

  return (
    <div className="pp-carousel" ref={scroller} onScroll={scrolled}>
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} current={venue.id === selectedId} />
      ))}
    </div>
  );
}

function ListRow({ venue, expanded }: { venue: Venue; expanded: boolean }) {
  const t = useMessages(messages);
  const { trips } = useTrips(venue);
  const myId = useMyId();
  const likers = useLikers(venue.id);
  const slowest = slowestRoute(trips.map((trip) => ({ ...trip, durationSeconds: trip.seconds })));
  const parts = [slowest && t.withinShort(minutesOf(slowest.seconds)), metaLine(venue)].filter(
    Boolean
  );
  const provider = useMeetingStore((state) => state.currentEvent?.mapProvider) ?? 'google';
  return (
    <div className="pp-list-item" data-expanded={expanded || undefined}>
      <div
        role="button"
        tabIndex={0}
        className="pp-list-row"
        onClick={() => {
          useMeetingStore.getState().setSelectedVenue(venue);
          usePhonePlanStore.setState({ expandedVenueId: expanded ? null : venue.id });
        }}
      >
        <VenueTile venue={venue} size={46} />
        <span className="pp-list-text">
          <b>{venue.name}</b>
          <small>{parts.join(' · ')}</small>
        </span>
        <AvatarStack people={likers} size={22} max={3} myId={myId} />
        <LikeButton venue={venue} size={40} />
      </div>
      {expanded && (
        <div className="pp-list-more">
          <p className="pp-address">{venue.address}</p>
          <TripBars venue={venue} />
          <div className="pp-list-actions">
            <button
              type="button"
              onClick={() => {
                useMeetingStore.getState().setSelectedVenue(venue);
                usePhonePlanStore.setState({ detent: 'small', expandedVenueId: null });
              }}
            >
              {t.seeOnMap}
            </button>
            <a href={venueMapsUrl(provider, venue)} target="_blank" rel="noopener noreferrer">
              <Navigation size={15} aria-hidden="true" />
              {t.directions}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function TripBarRow({ trip, longest }: { trip: Trip; longest: number }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const myId = useMyId();
  const isMe = trip.person.id === myId;
  const rights = useParticipantRights(trip.person);
  const [open, setOpen] = useState(false);
  return (
    <div className="pp-bar-item">
      <button
        type="button"
        className="pp-bar-row"
        disabled={!rights.editMode}
        aria-expanded={rights.editMode ? open : undefined}
        onClick={() => setOpen(!open)}
      >
        <Avatar person={trip.person} size={30} isYou={isMe} />
        <span className="pp-bar-mid">
          <small>{isMe ? t.you : trip.person.name}</small>
          <span className="pp-bar">
            <i
              style={{
                width: `${(trip.seconds / longest) * 100}%`,
                background: avatarTint(trip.person.color),
              }}
            />
          </span>
        </span>
        <b>{formatTripTime(trip.seconds, locale)}</b>
      </button>
      {open && rights.editMode && <ModePicker person={trip.person} />}
    </div>
  );
}

function TripBars({ venue }: { venue: Venue }) {
  const { trips } = useTrips(venue);
  const longest = Math.max(...trips.map((trip) => trip.seconds), 1);
  return (
    <div className="pp-bars">
      {trips.map((trip) => (
        <TripBarRow key={trip.person.id} trip={trip} longest={longest} />
      ))}
    </div>
  );
}

const THUMB = 52;
const INSET = 4;
const NUDGE = 26;

function SlideToLock({ venue }: { venue: Venue }) {
  const t = useMessages(messages);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    lastX: number;
    at: number;
    speed: number;
    moved: boolean;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [locking, setLocking] = useState(false);
  const span = () => (track.current?.clientWidth ?? 0) - THUMB - INSET * 2;

  useEffect(() => setOffset(0), [venue.id]);

  const lock = async () => {
    if (locking) return;
    setOffset(span());
    setLocking(true);
    const locked = await phonePlan.lockIn(venue);
    setLocking(false);
    if (!locked) setOffset(0);
  };
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (locking) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      lastX: event.clientX,
      at: event.timeStamp,
      speed: 0,
      moved: false,
    };
    setDragging(true);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const elapsed = event.timeStamp - current.at;
    if (elapsed > 0) current.speed = (event.clientX - current.lastX) / elapsed;
    current.lastX = event.clientX;
    current.at = event.timeStamp;
    if (Math.abs(event.clientX - current.x) > 3) current.moved = true;
    setOffset(slideOffset(event.clientX - current.x, span()));
  };
  const up = () => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (!current) return;
    if (!current.moved) {
      setOffset(NUDGE);
      setTimeout(() => setOffset(0), 220);
      return;
    }
    if (slideLocks(offset, span(), current.speed)) void lock();
    else setOffset(0);
  };

  return (
    <div className="pp-slide" ref={track} data-pp-own-gesture data-dragging={dragging || undefined}>
      <span className="pp-slide-fill" style={{ width: offset + THUMB + INSET * 2 }} />
      <span className="pp-slide-text" style={{ opacity: 1 - offset / Math.max(1, span()) }}>
        {t.slide(venue.name)}
      </span>
      <button
        type="button"
        className="pp-slide-thumb"
        aria-label={t.lock(venue.name)}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void lock();
          }
        }}
      >
        <Image src={catLogo} alt="" width={36} height={36} />
      </button>
    </div>
  );
}

export function PlacesPanel({ lockable }: { lockable: boolean }) {
  const t = useMessages(messages);
  const detent = usePhonePlanStore((state) => state.detent);
  const category = usePhonePlanStore((state) => state.category);
  const searchOpen = usePhonePlanStore((state) => state.searchOpen);
  const placeQuery = usePhonePlanStore((state) => state.placeQuery);
  const expandedId = usePhonePlanStore((state) => state.expandedVenueId);
  const searching = usePhonePlanStore((state) => state.searching);
  const searchError = usePhonePlanStore((state) => state.searchError);
  const venues = useMeetingStore((state) => state.searchedVenues);
  const selected = useMeetingStore((state) => state.selectedVenue);
  const likes = useVotingStore((state) => state.voteStatsByVenueId);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = selected ?? venues[0] ?? null;
  const sorted = [...venues].sort(
    (a, b) => (likes[b.id]?.voteCount ?? 0) - (likes[a.id]?.voteCount ?? 0)
  );

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  return (
    <>
      {searchOpen ? (
        <form
          className="pp-search-row"
          onSubmit={(event) => {
            event.preventDefault();
            inputRef.current?.blur();
            void phonePlan.search(placeQuery || CATEGORY_QUERY[category]);
          }}
        >
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            placeholder={t.searchPlaces}
            value={placeQuery}
            onChange={(event) => usePhonePlanStore.setState({ placeQuery: event.target.value })}
          />
          <button
            type="button"
            aria-label={t.closeSearch}
            className="pp-round"
            onClick={() => {
              usePhonePlanStore.setState({ searchOpen: false, placeQuery: '' });
              void phonePlan.search(CATEGORY_QUERY[category]);
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="pp-category-row">
          <button
            type="button"
            aria-label={t.open}
            className="pp-round"
            onClick={() => usePhonePlanStore.setState({ searchOpen: true, detent: 'full' })}
          >
            <Search size={20} aria-hidden="true" />
          </button>
          {CATEGORIES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="pp-category"
              aria-pressed={category === id}
              onClick={() => phonePlan.chooseCategory(id)}
            >
              {Icon && <Icon size={15} aria-hidden="true" />}
              {t[id]}
            </button>
          ))}
        </div>
      )}

      {detent === 'small' ? (
        <div className="pp-places-small">
          {venues.length > 0 ? (
            <Carousel venues={venues} />
          ) : (
            <div className="pp-empty">
              {searching ? (
                t.finding
              ) : searchError ? (
                <>
                  {t.failed}
                  <button type="button" onClick={phonePlan.searchThisArea}>
                    {t.retry}
                  </button>
                </>
              ) : (
                t.empty
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="pp-body pp-list" data-pp-scroll>
          {venues.length > 0 && <p className="pp-list-count">{t.count(venues.length)}</p>}
          {sorted.map((venue) => (
            <ListRow key={venue.id} venue={venue} expanded={expandedId === venue.id} />
          ))}
          {venues.length === 0 && (
            <div className="pp-empty">
              {searching ? t.finding : searchError ? t.failed : t.empty}
            </div>
          )}
        </div>
      )}

      {lockable && current && (
        <div className="pp-footer">
          <SlideToLock venue={current} />
        </div>
      )}
    </>
  );
}

export function LockedPanel() {
  const t = useMessages(messages);
  const locale = useLocale();
  const event = useMeetingStore((state) => state.currentEvent);
  const venue = useMeetingStore((state) =>
    state.currentEvent?.publishedVenueId
      ? state.venueById[state.currentEvent.publishedVenueId]
      : null
  );
  const isOrganizer = useAuthStore((state) => !!state.organizerParticipantId);
  const provider = event?.mapProvider ?? 'google';
  const when = event?.meetingTime
    ? t.lockedFor(whenShort(new Date(event.meetingTime), new Date(), locale))
    : t.lockedIn;
  return (
    <>
      <div className="pp-locked-head">
        <span>
          <Check size={15} strokeWidth={3} aria-hidden="true" />
          {when}
        </span>
        {isOrganizer && (
          <button
            type="button"
            className="pp-text-btn"
            onClick={() => void phonePlan.reopen(t.reopened)}
          >
            {t.changePlace}
          </button>
        )}
      </div>
      <div className="pp-body" data-pp-scroll>
        {venue && (
          <>
            <div className="pp-locked-venue">
              <VenueTile venue={venue} size={50} />
              <div>
                <h3>{venue.name}</h3>
                <p>
                  {metaLine(venue) && `${metaLine(venue)} · `}
                  {venue.address}
                </p>
              </div>
            </div>
            <TripBars venue={venue} />
          </>
        )}
      </div>
      <div className="pp-footer pp-footer-row">
        {venue && (
          <a
            className="pp-square pp-square-brand"
            aria-label={t.directions}
            href={venueMapsUrl(provider, venue)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={20} aria-hidden="true" />
          </a>
        )}
        <Cta onClick={() => usePhonePlanStore.setState({ ticketShown: true })}>{t.showTicket}</Cta>
      </div>
    </>
  );
}
