'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Share,
  Star,
  Store,
  Utensils,
  Wine,
  X,
} from 'lucide-react';
import {
  getVenueCategory,
  getVenueCategoryDisplay,
  type Venue,
  type VenueCategory,
} from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { venueClient } from '@/features/meeting/api';
import { useSidebarVenues } from '@/features/meeting/hooks/useSidebarVenues';
import { getHexColor } from '@/features/meeting/lib/participant-colors';
import { formatTripTime, slowestRoute } from '@/features/meeting/lib/route-summary';
import { stepVenue, venueLikes } from '@/features/meeting/lib/venue-list';
import { useMapStore, type UITravelMode } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { mapProviderName, venueMapsUrl } from '@/shared/lib/map-provider';
import type { MapProvider } from '@/shared/types/map';
import { travelModeMessages, travelModes, useChangeTravelMode } from './travel-type-filter';
import { VenuePanelFooter } from './venue-panel-footer';
import { AvatarStack, ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    previous: 'Previous spot',
    next: 'Next spot',
    share: 'Share this spot',
    close: 'Close venue details',
    theSpot: 'THE SPOT',
    you: 'You',
    openNow: 'Open now',
    closed: 'Closed',
    noLikes: 'No likes yet',
    likeCount: (n: number, total: number) => `${n} of ${total}`,
    nameSeparator: ', ',
    everyoneThere: 'Everyone there in',
    longestTrip: {
      car: (name: string) => `${name} has the longest trip, driving`,
      transit: (name: string) => `${name} has the longest trip, by transit`,
      walk: (name: string) => `${name} has the longest trip, walking`,
      bike: (name: string) => `${name} has the longest trip, biking`,
    } as Record<UITravelMode, (name: string) => string>,
    myLongestTrip: {
      car: 'You have the longest trip, driving',
      transit: 'You have the longest trip, by transit',
      walk: 'You have the longest trip, walking',
      bike: 'You have the longest trip, biking',
    } as Record<UITravelMode, string>,
    goesBy: 'Everyone goes by',
    travelTimes: 'Travel times',
    calculating: 'Working out everyone’s trip...',
    noRoutesYet: 'Trips show up once people add where they’re coming from.',
    joinForTrips: 'Join the plan to see everyone’s trip.',
    noRoute: 'No route',
    openIn: (provider: MapProvider) => `Open in ${mapProviderName(provider)}`,
    loadingDetails: 'Loading hours and contact details',
    noVenue: 'No venue selected',
  },
  zh: {
    previous: '上一个地点',
    next: '下一个地点',
    share: '分享这个地点',
    close: '关闭地点详情',
    theSpot: '已定',
    you: '我',
    openNow: '营业中',
    closed: '已打烊',
    noLikes: '还没有人喜欢',
    likeCount: (n: number, total: number) => `${n} / ${total} 人`,
    nameSeparator: '、',
    everyoneThere: '全员到齐需要',
    longestTrip: {
      car: (name: string) => `${name}路程最长（驾车）`,
      transit: (name: string) => `${name}路程最长（公交）`,
      walk: (name: string) => `${name}路程最长（步行）`,
      bike: (name: string) => `${name}路程最长（骑行）`,
    },
    myLongestTrip: {
      car: '我的路程最长（驾车）',
      transit: '我的路程最长（公交）',
      walk: '我的路程最长（步行）',
      bike: '我的路程最长（骑行）',
    },
    goesBy: '大家的出行方式',
    travelTimes: '路程时间',
    calculating: '正在计算路线…',
    noRoutesYet: '大家填好出发地后，这里会显示路程。',
    joinForTrips: '加入后就能看到大家的路程。',
    noRoute: '暂无路线',
    openIn: (provider: MapProvider) =>
      provider === 'amap' ? '在高德地图中打开' : '在 Google 地图中打开',
    loadingDetails: '正在加载营业时间和联系方式',
    noVenue: '还没有选择地点',
  },
});

const CATEGORY_ICON: Partial<Record<VenueCategory, ComponentType<{ className?: string }>>> = {
  cafe: Coffee,
  restaurant: Utensils,
  bar: Wine,
};

const TOOL_BUTTON =
  'grid size-[30px] place-items-center rounded-full bg-v2-ink/60 text-white backdrop-blur-[6px] transition-colors hover:bg-v2-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-v2-ink/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&_svg]:size-[15px]';

function useVenueDetails(venue: Venue | null, isOpen: boolean) {
  const [fetched, setFetched] = useState<{ id: string; details: Partial<Venue> | null } | null>(
    null
  );
  const venueId = venue?.id;

  useEffect(() => {
    if (!venueId || !isOpen) return;
    let stale = false;
    venueClient
      .get(venueId)
      .then((details) => {
        if (!stale) setFetched({ id: venueId, details });
      })
      .catch((error) => {
        // The panel keeps working with what the list already knows
        console.error('Failed to fetch venue details:', error);
        if (!stale) setFetched({ id: venueId, details: null });
      });
    return () => {
      stale = true;
    };
  }, [venueId, isOpen]);

  return {
    venue: venue && (fetched?.id === venue.id ? { ...venue, ...fetched.details } : venue),
    isLoadingDetails: !!venue && isOpen && fetched?.id !== venue.id,
  };
}

function VenuePhoto({ venue, isTheSpot }: { venue: Venue; isTheSpot: boolean }) {
  const t = useMessages(messages);
  const Icon = CATEGORY_ICON[getVenueCategory(venue.types)] ?? Store;
  return (
    <div className="relative grid h-[120px] flex-none place-items-center overflow-hidden rounded-t-[20px] bg-gradient-to-br from-[#b07a4a] to-[#6b3a2a] text-white/85 md:h-[168px]">
      {venue.photoUrl ? (
        <img src={venue.photoUrl} alt={venue.name} className="size-full object-cover" />
      ) : (
        <Icon className="size-[34px]" />
      )}
      {isTheSpot && (
        <span className="absolute left-3 top-3 flex items-center gap-[5px] rounded-full bg-v2-ticket px-[9px] py-1 font-v2-mono text-[11px] tracking-[.06em] text-white">
          <Check className="size-3" aria-hidden="true" />
          {t.theSpot}
        </span>
      )}
    </div>
  );
}

function VenueHeading({ venue }: { venue: Venue }) {
  const t = useMessages(messages);
  const locale = useLocale();
  return (
    <div>
      <h2
        id="venue-panel-title"
        className="m-0 text-[21px] font-bold leading-[1.2] tracking-[-.02em] text-balance text-v2-ink"
      >
        {venue.name}
      </h2>
      <div className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-v2-ink-2">
        {venue.rating != null && (
          <span className="inline-flex items-center gap-[3px] font-semibold text-v2-ink">
            <Star className="size-[13px] fill-[#f5b301] text-[#f5b301]" aria-hidden="true" />
            {venue.rating.toFixed(1)}
          </span>
        )}
        {!!venue.priceLevel && <span>{'$'.repeat(venue.priceLevel)}</span>}
        <span className="capitalize">{getVenueCategoryDisplay(venue, locale)}</span>
        {venue.openNow != null && (
          <span
            className={cn('font-medium', venue.openNow ? 'text-v2-mint' : 'text-v2-coral-deep')}
          >
            {venue.openNow ? t.openNow : t.closed}
          </span>
        )}
      </div>
      {venue.address && <div className="mt-[3px] text-[13px] text-v2-ink-2">{venue.address}</div>}
    </div>
  );
}

function VenueLikes({ venueId, myId }: { venueId: string; myId: string | null }) {
  const t = useMessages(messages);
  const participants = useMeetingStore((state) => state.currentEvent?.participants) ?? [];
  const { voteStatsByVenueId } = useVotingStore();
  const { voters, others, total } = venueLikes(
    voteStatsByVenueId[venueId]?.voterIds ?? [],
    participants,
    myId
  );

  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px] text-v2-ink-2">
      <AvatarStack>
        {voters.map((p) => (
          <ParticipantAvatar key={p.id} participant={p} />
        ))}
        {others.map((p) => (
          <ParticipantAvatar key={p.id} participant={p} ghost />
        ))}
      </AvatarStack>
      {voters.length > 0 ? (
        <span>
          <b className="font-semibold text-v2-ink">{t.likeCount(voters.length, total)}</b>
          {' · '}
          {voters.map((p) => (p.id === myId ? t.you : p.name)).join(t.nameSeparator)}
        </span>
      ) : (
        <span>{t.noLikes}</span>
      )}
    </div>
  );
}

function ModeSelector() {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const travelMode = useMapStore((state) => state.travelMode);
  const changeMode = useChangeTravelMode();
  return (
    <div className="grid flex-none justify-items-end gap-[3px] text-[11px] text-v2-ink-3">
      {t.goesBy}
      <div role="group" aria-label={t.goesBy} className="flex rounded-full bg-v2-wash p-0.5">
        {travelModes.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={travelMode === value}
            aria-label={modeLabels[value]}
            title={modeLabels[value]}
            onClick={() => changeMode(value)}
            className={cn(
              'grid h-[25px] w-[27px] place-items-center rounded-full [&_svg]:size-3.5',
              travelMode === value
                ? 'bg-white text-v2-ink shadow-[0_1px_2px_rgba(33,37,43,.14)]'
                : 'text-v2-ink-3'
            )}
          >
            <Icon aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TripRows({ myId }: { myId: string | null }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const participants = useMeetingStore((state) => state.currentEvent?.participants) ?? [];
  const { routes, selectedParticipantId, setSelectedParticipantId } = useMapStore();
  const longest = slowestRoute(routes)?.durationSeconds ?? 0;
  const mineFirst = [...participants].sort((a, b) => Number(b.id === myId) - Number(a.id === myId));

  return (
    <div className="mt-2 grid gap-[3px]">
      {mineFirst.map((participant) => {
        const route = routes.find((r) => r.participantId === participant.id);
        return (
          <button
            key={participant.id}
            type="button"
            aria-pressed={selectedParticipantId === participant.id}
            onClick={() =>
              setSelectedParticipantId(
                selectedParticipantId === participant.id ? null : participant.id
              )
            }
            className={cn(
              '-mx-1 grid grid-cols-[24px_minmax(0,64px)_minmax(20px,1fr)_auto] items-center gap-[7px] rounded-[10px] px-1 py-[3px] text-left text-[13px] tabular-nums md:grid-cols-[24px_minmax(0,64px)_minmax(20px,1fr)_auto_48px]',
              selectedParticipantId === participant.id ? 'bg-v2-coral-wash' : 'hover:bg-v2-wash'
            )}
          >
            <ParticipantAvatar participant={participant} />
            <span className="truncate text-v2-ink">
              {participant.id === myId ? t.you : participant.name}
            </span>
            {route ? (
              <>
                <span className="h-1.5 overflow-hidden rounded-md bg-v2-wash">
                  <i
                    className="block h-full rounded-md transition-[width] duration-300"
                    style={{
                      width: `${Math.max(4, (route.durationSeconds / longest) * 100)}%`,
                      backgroundColor: getHexColor(participant.color),
                    }}
                  />
                </span>
                <strong className="whitespace-nowrap text-right font-semibold text-v2-ink">
                  {formatTripTime(route.durationSeconds, locale)}
                </strong>
                <small className="hidden whitespace-nowrap text-right text-xs text-v2-ink-3 md:block">
                  {route.distance}
                </small>
              </>
            ) : (
              <span className="col-span-2 text-right text-xs text-v2-ink-3 md:col-span-3">
                {t.noRoute}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TravelSection({ myId, hasJoined }: { myId: string | null; hasJoined: boolean }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const { routes, isCalculatingRoutes, travelMode } = useMapStore();
  const participants = useMeetingStore((state) => state.currentEvent?.participants) ?? [];

  const slowest = isCalculatingRoutes ? null : slowestRoute(routes);
  const slowestPerson = participants.find((p) => p.id === slowest?.participantId);

  return (
    <section>
      <div className="flex items-start justify-between gap-2">
        {slowest ? (
          <div>
            <h3 className="m-0 text-sm font-semibold tracking-[-.01em] text-v2-ink">
              {t.everyoneThere}{' '}
              <em className="not-italic text-v2-coral-deep">
                {formatTripTime(slowest.durationSeconds, locale)}
              </em>
            </h3>
            {slowestPerson && (
              <div className="mt-px text-xs text-v2-ink-2">
                {slowestPerson.id === myId
                  ? t.myLongestTrip[travelMode]
                  : t.longestTrip[travelMode](slowestPerson.name)}
              </div>
            )}
          </div>
        ) : (
          <h3 className="m-0 text-sm font-semibold tracking-[-.01em] text-v2-ink">
            {t.travelTimes}
          </h3>
        )}
        {hasJoined && <ModeSelector />}
      </div>
      {isCalculatingRoutes ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-[13px] text-v2-ink-2">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t.calculating}
        </p>
      ) : routes.length > 0 ? (
        <TripRows myId={myId} />
      ) : (
        <p className="mt-2 text-[13px] text-v2-ink-2">
          {hasJoined ? t.noRoutesYet : t.joinForTrips}
        </p>
      )}
    </section>
  );
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[18px_1fr] gap-2.5 py-[5px] text-left text-v2-ink">
      <Icon className="mt-0.5 size-[15px] text-v2-ink-3" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function HoursLine({ line }: { line: string }) {
  const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (!match) return <div>{line}</div>;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-v2-ink-2">{match[1]}</span>
      <span>{match[2]}</span>
    </div>
  );
}

function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function VenueFacts({ venue, isLoading }: { venue: Venue; isLoading: boolean }) {
  const t = useMessages(messages);
  const mapProvider = useMeetingStore((state) => state.currentEvent?.mapProvider) ?? 'google';
  return (
    <div className="grid gap-px border-t border-v2-line pt-2 text-[13px]">
      {isLoading ? (
        <p role="status" className="flex items-center gap-2 py-[5px] text-v2-ink-2">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t.loadingDetails}
        </p>
      ) : (
        <>
          {!!venue.openingHours?.length && (
            <Fact icon={Clock}>
              {venue.openingHours.map((line) => (
                <HoursLine key={line} line={line} />
              ))}
            </Fact>
          )}
          {venue.formattedPhoneNumber && (
            <Fact icon={Phone}>
              <a href={`tel:${venue.formattedPhoneNumber}`} className="hover:underline">
                {venue.formattedPhoneNumber}
              </a>
            </Fact>
          )}
          {venue.website && (
            <Fact icon={Globe}>
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate hover:underline"
              >
                {websiteLabel(venue.website)}
              </a>
            </Fact>
          )}
        </>
      )}
      <Fact icon={MapPin}>
        <a
          href={venueMapsUrl(mapProvider, venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {t.openIn(mapProvider)}
        </a>
      </Fact>
    </div>
  );
}

export function VenuePanel() {
  const t = useMessages(messages);
  const { isVenueInfoOpen, closeVenueInfo, openVenueInfo, openShareModal } = useUIStore();
  const { selectedVenue, currentEvent, setSelectedVenue } = useMeetingStore();
  const { organizerParticipantId, currentParticipantId, isOrganizerMode, isParticipantMode } =
    useAuthStore();
  const { venue, isLoadingDetails } = useVenueDetails(selectedVenue, isVenueInfoOpen);
  const sidebarList = useSidebarVenues();
  const myId = organizerParticipantId || currentParticipantId;

  useEffect(() => {
    if (!isVenueInfoOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeVenueInfo();
      setSelectedVenue(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVenueInfoOpen, closeVenueInfo, setSelectedVenue]);

  const previous = venue && stepVenue(sidebarList, venue.id, -1);
  const next = venue && stepVenue(sidebarList, venue.id, 1);
  const goTo = (target: Venue) => {
    setSelectedVenue(target);
    openVenueInfo(target.id);
  };

  return (
    <aside
      inert={!isVenueInfoOpen}
      className={cn(
        // Mobile: match sidebar height (50vh from bottom)
        'fixed bottom-0 left-0 right-0 h-[50vh] w-full',
        // Desktop: match sidebar positioning and size
        'md:absolute md:top-[10vh] md:bottom-3 md:h-auto md:max-h-[calc(90vh-1rem)]',
        'md:left-[calc(320px+24px)] lg:left-[calc(360px+24px)] xl:left-[calc(400px+24px)]',
        'md:w-[320px] lg:w-[360px] xl:w-[400px]',
        'md:right-auto',
        'z-40 flex flex-col overflow-hidden bg-v2-paper text-sm leading-[1.45] text-v2-ink',
        'rounded-t-[20px] md:rounded-[20px]',
        'shadow-[0_1px_2px_rgba(33,37,43,.06),0_12px_32px_rgba(33,37,43,.14)]',
        'transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(.2,.9,.3,1)] motion-reduce:transition-none',
        isVenueInfoOpen
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0'
      )}
      aria-labelledby="venue-panel-title"
    >
      {venue ? (
        <>
          <VenuePhoto venue={venue} isTheSpot={currentEvent?.publishedVenueId === venue.id} />
          <div className="absolute right-2.5 top-2.5 z-[1] flex gap-[5px]">
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t.previous}
              title={t.previous}
              disabled={!previous}
              onClick={() => previous && goTo(previous)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t.next}
              title={t.next}
              disabled={!next}
              onClick={() => next && goTo(next)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t.share}
              title={t.share}
              onClick={openShareModal}
            >
              <Share aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL_BUTTON}
              aria-label={t.close}
              title={t.close}
              onClick={() => {
                closeVenueInfo();
                setSelectedVenue(null);
              }}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[13px] overflow-y-auto px-[18px] py-3.5 [scrollbar-color:var(--color-v2-line)_transparent] [scrollbar-width:thin]">
            <VenueHeading venue={venue} />
            <VenueLikes venueId={venue.id} myId={myId} />
            <TravelSection myId={myId} hasJoined={isOrganizerMode || isParticipantMode} />
            <VenueFacts venue={venue} isLoading={isLoadingDetails} />
          </div>
          <VenuePanelFooter key={venue.id} venue={venue} />
        </>
      ) : (
        isVenueInfoOpen && (
          <p className="grid h-full place-items-center p-8 text-sm text-v2-ink-2">{t.noVenue}</p>
        )
      )}
    </aside>
  );
}
