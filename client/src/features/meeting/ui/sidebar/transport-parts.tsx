'use client';

import { useEffect, type ComponentType } from 'react';
import { Bike, Bus, Car, PersonStanding } from 'lucide-react';
import type { Participant } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useChangeParticipantMode } from '@/features/meeting/hooks/useParticipantActions';
import {
  participantRights,
  viewerFromAuth,
  type RowTag,
} from '@/features/meeting/lib/participant-rights';
import { hasStartingPoint, routeKey } from '@/features/meeting/lib/person-routes';
import { formatTripTime } from '@/features/meeting/lib/route-summary';
import { useMapStore, type UITravelMode } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import type { TravelMode } from '@/shared/types/map';
import { travelModeMessages } from './travel-type-filter';

const messages = defineMessages({
  en: {
    tag: {
      host: 'HOST',
      addedByYou: 'ADDED BY YOU',
      addedBy: (name: string) => `ADDED BY ${name.toUpperCase()}`,
    },
    howYouGo: 'How you get there',
    howTheyGo: (name: string) => `How ${name} gets there`,
    noRoute: 'No route',
    checking: '…',
    modeFrom: (label: string, place: string) => `${label} from ${place}`,
    onlyThem: (name: string) => `Only ${name} can change this`,
    hostSets: (host: string) => `${host} sets this`,
    compareYours: 'Compare your ways there',
    howIs: (name: string) => `How is ${name} getting there?`,
    chose: (name: string, mode: string) =>
      `${name} chose ${mode.toLowerCase()}. Only ${name} can change this.`,
    hostSet: (host: string, name: string, mode: string) =>
      `${host} set ${name} to ${mode.toLowerCase()}.`,
    going: (name: string, mode: string) => `${name} is going by ${mode.toLowerCase()}.`,
    youGoing: (mode: string) => `You're going by ${mode.toLowerCase()}.`,
  },
  zh: {
    tag: {
      host: '发起人',
      addedByYou: '你添加的',
      addedBy: (name: string) => `${name}添加的`,
    },
    howYouGo: '我怎么过去',
    howTheyGo: (name: string) => `${name}怎么过去`,
    noRoute: '暂无路线',
    checking: '…',
    modeFrom: (label: string, place: string) => `${label}，从${place}出发`,
    onlyThem: (name: string) => `只有${name}能修改`,
    hostSets: (host: string) => `由${host}设置`,
    compareYours: '比较一下怎么过去',
    howIs: (name: string) => `${name}怎么过去？`,
    chose: (name: string, mode: string) => `${name}选择了${mode}。只有${name}能修改。`,
    hostSet: (host: string, name: string, mode: string) => `${host}把${name}设为${mode}。`,
    going: (name: string, mode: string) => `${name}将${mode}前往。`,
    youGoing: (mode: string) => `你将${mode}前往。`,
  },
});

/** v2's order. The wording that goes with each is keyed by `ui`. */
export const PICKER_MODES: ReadonlyArray<{
  mode: TravelMode;
  ui: UITravelMode;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
}> = [
  { mode: 'driving', ui: 'car', icon: Car },
  { mode: 'transit', ui: 'transit', icon: Bus },
  { mode: 'bicycling', ui: 'bike', icon: Bike },
  { mode: 'walking', ui: 'walk', icon: PersonStanding },
];

export function pickerMode(mode: TravelMode) {
  return PICKER_MODES.find((option) => option.mode === mode) ?? PICKER_MODES[0];
}

export function useParticipantRights(person: Participant) {
  const organizerParticipantId = useAuthStore((state) => state.organizerParticipantId);
  const currentParticipantId = useAuthStore((state) => state.currentParticipantId);
  const event = useMeetingStore((state) => state.currentEvent);
  return participantRights(
    viewerFromAuth({ organizerParticipantId, currentParticipantId }),
    person,
    {
      isPublished: !!event?.publishedAt,
      hostName: hostOf(event?.participants)?.name ?? null,
    }
  );
}

function hostOf(participants: readonly Participant[] | undefined) {
  return participants?.find((p) => p.isOrganizer);
}

export function RowTagBadge({ tag }: { tag: RowTag }) {
  const t = useMessages(messages);
  const label =
    tag.kind === 'addedBy'
      ? t.tag.addedBy(tag.name)
      : tag.kind === 'host'
        ? t.tag.host
        : t.tag.addedByYou;
  return (
    <span className="min-w-0 truncate rounded-full bg-v2-wash px-1.5 py-px font-v2-mono text-[9.5px] font-medium text-v2-ink-2">
      {label}
    </span>
  );
}

/**
 * What's known about each mode for this person at the selected venue. Comparing the other three
 * costs calls, so it only happens while `compare` is on, and each trip is asked for at most once.
 */
function useModeLookups(person: Participant, compare: boolean) {
  const venueId = useMeetingStore((state) => state.selectedVenue?.id);
  const eventId = useMeetingStore((state) => state.currentEvent?.id);
  const token = useAuthStore((state) => state.organizerToken || state.participantToken);
  const entries = useRouteCacheStore((state) => state.entries);
  const routes = useMapStore((state) => state.routes);
  const routable = hasStartingPoint(person);
  const currentKey = venueId ? routeKey(venueId, person) : null;

  useEffect(() => {
    if (!compare || !venueId || !eventId || !token || !routable) return;
    PICKER_MODES.filter(({ mode }) => mode !== person.travelMode).forEach(({ mode }) => {
      void useRouteCacheStore.getState().compare({ eventId, venueId, person, mode, token });
    });
    // The key stands for everything about the person that a trip depends on
  }, [compare, currentKey, eventId, token, routable]);

  return (mode: TravelMode) => {
    if (!venueId || !routable) return undefined;
    const drawn = routes.find((r) => r.participantId === person.id && r.travelMode === mode);
    return drawn
      ? ({ status: 'found', route: drawn } as const)
      : entries[routeKey(venueId, person, mode)];
  };
}

/** Four modes, each with its time to the selected venue once known. Picking one commits it. */
export function ModePicker({ person, compare }: { person: Participant; compare: boolean }) {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const locale = useLocale();
  const changeMode = useChangeParticipantMode();
  const lookupOf = useModeLookups(person, compare);
  const myId = useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);

  return (
    <div
      role="group"
      aria-label={person.id === myId ? t.howYouGo : t.howTheyGo(person.name)}
      className="mt-[5px] grid grid-cols-4 gap-[3px]"
    >
      {PICKER_MODES.map(({ mode, ui, icon: Icon }) => {
        const lookup = lookupOf(mode);
        const selected = person.travelMode === mode;
        const detail =
          lookup?.status === 'found'
            ? formatTripTime(lookup.route.durationSeconds, locale)
            : lookup?.status === 'none'
              ? t.noRoute
              : lookup?.status === 'loading'
                ? t.checking
                : modeLabels[ui];
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={selected}
            title={modeLabels[ui]}
            onClick={(event) => {
              event.stopPropagation();
              void changeMode(person, mode);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              'grid min-w-0 justify-items-center gap-px rounded-[10px] px-0.5 pb-1 pt-[5px] text-center text-[11px] leading-tight tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink',
              selected
                ? 'bg-v2-ink font-semibold text-white'
                : 'bg-v2-wash text-v2-ink-2 hover:bg-[#efebe5]'
            )}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
            <span className="max-w-full">{detail}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A row the viewer can't change: how the person is going, and who could change it. */
export function ModeLine({ person }: { person: Participant }) {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const hostName = useMeetingStore((state) => hostOf(state.currentEvent?.participants)?.name);
  const isPublished = useMeetingStore((state) => !!state.currentEvent?.publishedAt);
  const { ui, icon: Icon } = pickerMode(person.travelMode);
  const title = isPublished
    ? undefined
    : person.claimable
      ? hostName && t.hostSets(hostName)
      : t.onlyThem(person.name);
  return (
    <div title={title} className="mt-0.5 flex items-center gap-[5px] text-[12.5px] text-v2-ink-2">
      <Icon className="size-3.5 flex-none" aria-hidden="true" />
      <span className="truncate">
        {person.address ? t.modeFrom(modeLabels[ui], person.address) : modeLabels[ui]}
      </span>
    </div>
  );
}

/** Under the venue's trips: the selected person's compare, or a sentence on who decides. */
export function FocusBox({ person }: { person: Participant }) {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const rights = useParticipantRights(person);
  const hostName = useMeetingStore((state) => hostOf(state.currentEvent?.participants)?.name);
  const isPublished = useMeetingStore((state) => !!state.currentEvent?.publishedAt);
  const mode = modeLabels[pickerMode(person.travelMode).ui];

  return (
    <div className="mt-2.5 grid gap-0.5 rounded-xl bg-v2-coral-wash p-2.5 text-[12.5px] text-v2-ink-2 [&_[aria-pressed=false]]:bg-white">
      {rights.editMode ? (
        <>
          <b className="font-semibold text-v2-ink">
            {rights.isSelf ? t.compareYours : t.howIs(person.name)}
          </b>
          <ModePicker person={person} compare />
        </>
      ) : isPublished ? (
        <span>{rights.isSelf ? t.youGoing(mode) : t.going(person.name, mode)}</span>
      ) : person.claimable && hostName ? (
        <span>{t.hostSet(hostName, person.name, mode)}</span>
      ) : (
        <span>{t.chose(person.name, mode)}</span>
      )}
    </div>
  );
}
