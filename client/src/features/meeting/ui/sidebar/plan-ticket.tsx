'use client';

import '@fontsource/anton/400.css';
import '@fontsource/jetbrains-mono/400.css';
import { useEffect, useRef, useState } from 'react';
import { Check, Navigation, Share } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { invitationFor, isPublished } from '@/features/invitation/model/invitation';
import type { Event } from '@/entities';
import { hasStartingPoint, routeKey } from '@/features/meeting/lib/person-routes';
import { formatTripTime, tripClaim, tripOf, type Trip } from '@/features/meeting/lib/route-summary';
import { useMapStore, type RouteInfo } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';
import { unpublishVenue } from '@/features/meeting/model/publish-venue';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { venueMapsUrl } from '@/shared/lib/map-provider';
import { BUTTON } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    set: "IT'S SET",
    share: 'Share invite',
    directions: 'Directions',
    changeSpot: 'Change the spot',
    changing: 'Changing...',
    changeFailed: "Couldn't change the spot. Try again.",
    within: (time: string) => `Everyone gets there within ${time}.`,
    someWithin: (reached: number, total: number, time: string) =>
      `${reached} of ${total} people get there within ${time}.`,
  },
  zh: {
    set: '已定',
    share: '分享邀请',
    directions: '导航',
    changeSpot: '更换地点',
    changing: '正在更换…',
    changeFailed: '没能更换地点，请重试。',
    within: (time: string) => `大家 ${time}内都能到。`,
    someWithin: (reached: number, total: number, time: string) =>
      `${total} 人中有 ${reached} 人 ${time}内能到。`,
  },
});

export interface PublishSighting {
  eventId: string | undefined;
  published: boolean;
}

/** True only when an event already on screen becomes published, never when one loads published. */
export function isPublishMoment(previous: PublishSighting, next: PublishSighting) {
  return previous.eventId === next.eventId && !previous.published && next.published;
}

function usePublishStamp(sighting: PublishSighting) {
  const [seen, setSeen] = useState(sighting);
  const [stamp, setStamp] = useState(false);
  if (seen.eventId !== sighting.eventId || seen.published !== sighting.published) {
    setSeen(sighting);
    setStamp(isPublishMoment(seen, sighting));
  }
  return stamp;
}

/**
 * Everyone's trip to the spot. The map only holds routes for the selected venue, so when the spot
 * isn't selected, as after a reload, the ticket looks the trips up itself.
 */
function useSpotTrips(event: Event | null, spotId: string | null) {
  const spotSelected = useMeetingStore((state) => !!spotId && state.selectedVenue?.id === spotId);
  const { routes, tripRequests, isCalculatingRoutes } = useMapStore();
  const entries = useRouteCacheStore((state) => state.entries);
  const token = useAuthStore((state) => state.organizerToken || state.participantToken);
  const people = event?.participants ?? [];
  const unknown = spotId
    ? people
        .filter(hasStartingPoint)
        .map((person) => routeKey(spotId, person))
        .filter((key) => !entries[key])
        .join(' ')
    : '';

  useEffect(() => {
    if (spotSelected || !unknown || !event || !spotId || !token) return;
    void useRouteCacheStore
      .getState()
      .lookupVenue({ eventId: event.id, venueId: spotId, people: event.participants, token });
    // Only a person whose trip isn't known yet is worth a request, so `event` itself isn't a dep
  }, [spotSelected, unknown, spotId, token]);

  if (!spotId) return null;
  if (spotSelected) {
    return isCalculatingRoutes
      ? null
      : people.map((person) => tripOf(person, routes, tripRequests[person.id]));
  }
  return people.map((person): Trip<RouteInfo> => {
    if (!hasStartingPoint(person)) return { status: 'no-start' };
    const lookup = entries[routeKey(spotId, person)];
    if (lookup?.status === 'found') return { status: 'found', route: lookup.route };
    return lookup?.status === 'none' ? { status: 'none' } : { status: 'pending' };
  });
}

export function PlanTicket() {
  const t = useMessages(messages);
  const locale = useLocale();
  const { currentEvent, selectedVenue, venueById, hydrateVenue } = useMeetingStore();
  const { openShareModal } = useUIStore();
  const { isOrganizerMode, organizerToken } = useAuthStore();
  const [isChanging, setIsChanging] = useState(false);
  const [changeFailed, setChangeFailed] = useState(false);

  const event = currentEvent && isPublished(currentEvent) ? currentEvent : null;
  const spotId = event?.publishedVenueId ?? null;
  const trips = useSpotTrips(event, spotId);
  const stamp = usePublishStamp({ eventId: currentEvent?.id, published: !!event });
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (spotId) hydrateVenue(spotId);
  }, [spotId, hydrateVenue]);

  // The sidebar is usually scrolled to the card that was just picked, far below the ticket
  useEffect(() => {
    if (stamp) ticketRef.current?.scrollIntoView({ block: 'start' });
  }, [stamp]);

  if (!event || !spotId) return null;

  const venue = selectedVenue?.id === spotId ? selectedVenue : (venueById[spotId] ?? null);
  const { title, when } = invitationFor(event, venue, '');
  const claim = trips && tripClaim(trips);

  const changeSpot = async () => {
    if (!organizerToken) return;
    setIsChanging(true);
    setChangeFailed(false);
    try {
      await unpublishVenue(event.id, organizerToken);
    } catch (error) {
      console.error('Failed to change the spot:', error);
      setChangeFailed(true);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div
      ref={ticketRef}
      className={cn(
        'relative rounded-2xl bg-v2-ticket text-sm text-v2-paper',
        stamp && 'plan-ticket-stamp'
      )}
    >
      <div className="px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-1.5 font-v2-mono text-[11px] uppercase tracking-[.1em] text-[#ffd6d6]">
          <Check className="size-3 flex-none" aria-hidden="true" />
          <span className="truncate">
            {t.set} · {title}
          </span>
        </div>
        <div className="my-2 font-v2-display text-[26px] uppercase leading-[1.08] tracking-[.01em] md:text-[32px]">
          {venue?.name ?? title}
        </div>
        {when && (
          <div className="font-v2-mono text-xs uppercase">
            {when.date} · {when.time}
          </div>
        )}
        {venue?.address && <div className="mt-0.5 text-[13px] text-[#ffe3e3]">{venue.address}</div>}
      </div>
      <div className="plan-ticket-cut" />
      <div className="grid gap-2.5 px-4 pb-3.5 pt-3">
        {claim && (
          <div className="text-[13px] text-white">
            {claim.reached === claim.total
              ? t.within(formatTripTime(claim.slowest.durationSeconds, locale))
              : t.someWithin(
                  claim.reached,
                  claim.total,
                  formatTripTime(claim.slowest.durationSeconds, locale)
                )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(BUTTON.radiant, 'min-w-0 flex-1 px-2.5')}
            onClick={openShareModal}
          >
            <Share aria-hidden="true" />
            {t.share}
          </button>
          <button
            type="button"
            className={cn(BUTTON.ghost, 'min-w-0 flex-1 px-2.5')}
            disabled={!venue}
            onClick={() => {
              if (venue) {
                window.open(
                  venueMapsUrl(event.mapProvider ?? 'google', venue),
                  '_blank',
                  'noopener,noreferrer'
                );
              }
            }}
          >
            <Navigation aria-hidden="true" />
            {t.directions}
          </button>
        </div>
        {isOrganizerMode && (
          <button
            type="button"
            className="justify-self-center text-[12.5px] text-[#ffd6d6] underline underline-offset-2 disabled:opacity-60"
            disabled={isChanging}
            onClick={changeSpot}
          >
            {isChanging ? t.changing : t.changeSpot}
          </button>
        )}
        {changeFailed && (
          <p role="alert" className="text-center text-[12.5px] text-white">
            {t.changeFailed}
          </p>
        )}
      </div>
    </div>
  );
}
