'use client';

import '@fontsource/anton/400.css';
import '@fontsource/jetbrains-mono/400.css';
import { useEffect, useState } from 'react';
import { Check, Navigation, Share } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { invitationFor, isPublished } from '@/features/invitation/model/invitation';
import { formatTripTime, slowestRoute } from '@/features/meeting/lib/route-summary';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
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
  },
  zh: {
    set: '已定',
    share: '分享邀请',
    directions: '导航',
    changeSpot: '更换地点',
    changing: '正在更换…',
    changeFailed: '没能更换地点，请重试。',
    within: (time: string) => `大家 ${time}内都能到。`,
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

export function PlanTicket() {
  const t = useMessages(messages);
  const locale = useLocale();
  const { currentEvent, selectedVenue, venueById, hydrateVenue } = useMeetingStore();
  const { openShareModal } = useUIStore();
  const { isOrganizerMode, organizerToken } = useAuthStore();
  const { routes, isCalculatingRoutes } = useMapStore();
  const [isChanging, setIsChanging] = useState(false);
  const [changeFailed, setChangeFailed] = useState(false);

  const event = currentEvent && isPublished(currentEvent) ? currentEvent : null;
  const spotId = event?.publishedVenueId ?? null;
  const stamp = usePublishStamp({ eventId: currentEvent?.id, published: !!event });

  useEffect(() => {
    if (spotId) hydrateVenue(spotId);
  }, [spotId, hydrateVenue]);

  if (!event || !spotId) return null;

  const venue = selectedVenue?.id === spotId ? selectedVenue : (venueById[spotId] ?? null);
  const { title, when } = invitationFor(event, venue, '');
  // The store only ever holds routes for the selected venue
  const slowest =
    selectedVenue?.id === spotId && !isCalculatingRoutes ? slowestRoute(routes) : null;

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
        {slowest && (
          <div className="text-[13px] text-white">
            {t.within(formatTripTime(slowest.durationSeconds, locale))}
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
