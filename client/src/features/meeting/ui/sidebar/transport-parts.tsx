'use client';

import { useEffect, type ComponentType } from 'react';
import { Bike, Bus, Car, ChevronDown, PersonStanding } from 'lucide-react';
import type { Participant } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useChangeParticipantMode } from '@/features/meeting/hooks/useParticipantActions';
import {
  participantRights,
  viewerFromAuth,
  type ParticipantRights,
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
    modeFrom: (label: string, place: string) => `${label} · ${place}`,
    compareYours: 'Compare your ways there',
    howIs: (name: string) => `How is ${name} getting there?`,
    chose: (name: string, mode: string) =>
      `${name} chose ${mode.toLowerCase()}. Only ${name} can change this.`,
    hostSet: (host: string, name: string, mode: string) =>
      `${host} set ${name} to ${mode.toLowerCase()}.`,
    choseThis: (name: string) => `${name} chose this. Only ${name} can change it.`,
    hostSetThis: (host: string, name: string) => `${host} set this for ${name}.`,
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
    modeFrom: (label: string, place: string) => `${label} · ${place}`,
    compareYours: '比较一下怎么过去',
    howIs: (name: string) => `${name}怎么过去？`,
    chose: (name: string, mode: string) => `${name}选择了${mode}。只有${name}能修改。`,
    hostSet: (host: string, name: string, mode: string) => `${host}把${name}设为${mode}。`,
    choseThis: (name: string) => `这是${name}自己选的，只有${name}能修改。`,
    hostSetThis: (host: string, name: string) => `这是${host}替${name}设置的。`,
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
 * costs calls, so it only happens while someone is looking, and each trip is asked for at most once.
 */
function useModeLookups(person: Participant) {
  const venueId = useMeetingStore((state) => state.selectedVenue?.id);
  const eventId = useMeetingStore((state) => state.currentEvent?.id);
  const token = useAuthStore((state) => state.organizerToken || state.participantToken);
  const entries = useRouteCacheStore((state) => state.entries);
  const routes = useMapStore((state) => state.routes);
  const routable = hasStartingPoint(person);
  const currentKey = venueId ? routeKey(venueId, person) : null;

  useEffect(() => {
    if (!venueId || !eventId || !token || !routable) return;
    PICKER_MODES.filter(({ mode }) => mode !== person.travelMode).forEach(({ mode }) => {
      void useRouteCacheStore.getState().compare({ eventId, venueId, person, mode, token });
    });
    // The key stands for everything about the person that a trip depends on
  }, [currentKey, eventId, token, routable]);

  return (mode: TravelMode) => {
    if (!venueId || !routable) return undefined;
    const drawn = routes.find((r) => r.participantId === person.id && r.travelMode === mode);
    return drawn
      ? ({ status: 'found', route: drawn } as const)
      : entries[routeKey(venueId, person, mode)];
  };
}

/** Four modes, each saying whatever is known about it. */
export function ModeGrid({
  value,
  onChange,
  detailOf,
  label,
}: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  detailOf: (mode: TravelMode, modeLabel: string) => string;
  label: string;
}) {
  const modeLabels = useMessages(travelModeMessages).modes;
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-[3px]">
      {PICKER_MODES.map(({ mode, ui, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          title={modeLabels[ui]}
          onClick={(event) => {
            event.stopPropagation();
            onChange(mode);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') event.stopPropagation();
          }}
          className={cn(
            'grid min-w-0 justify-items-center gap-px rounded-[10px] px-0.5 pb-1.5 pt-[7px] text-center text-[11px] leading-tight tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink',
            value === mode
              ? 'bg-v2-ink font-semibold text-white'
              : 'bg-white text-v2-ink-2 hover:text-v2-ink'
          )}
        >
          <Icon className="size-[15px]" aria-hidden="true" />
          <span className="max-w-full whitespace-nowrap">{detailOf(mode, modeLabels[ui])}</span>
        </button>
      ))}
    </div>
  );
}

/** The person's own modes with their times to the selected venue. Picking one commits it. */
export function ModePicker({ person }: { person: Participant }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const changeMode = useChangeParticipantMode();
  const lookupOf = useModeLookups(person);
  const myId = useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);

  return (
    <ModeGrid
      value={person.travelMode}
      onChange={(mode) => void changeMode(person, mode)}
      label={person.id === myId ? t.howYouGo : t.howTheyGo(person.name)}
      detailOf={(mode, modeLabel) => {
        const lookup = lookupOf(mode);
        if (lookup?.status === 'found') return formatTripTime(lookup.route.durationSeconds, locale);
        if (lookup?.status === 'none') return t.noRoute;
        return lookup?.status === 'loading' ? t.checking : modeLabel;
      }}
    />
  );
}

/** One line under the name: how they're going and from where. */
export function HowLine({
  person,
  open,
  expandable,
}: {
  person: Participant;
  open: boolean;
  expandable: boolean;
}) {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const { ui, icon: Icon } = pickerMode(person.travelMode);
  return (
    <div className="mt-0.5 flex items-center gap-[5px] text-[12.5px] text-v2-ink-2">
      <Icon className="size-3.5 flex-none" aria-hidden="true" />
      <span className="min-w-0 truncate" title={person.address ?? undefined}>
        {person.address ? t.modeFrom(modeLabels[ui], person.address) : modeLabels[ui]}
      </span>
      {expandable && (
        <ChevronDown
          className={cn(
            'ml-auto size-[13px] flex-none text-v2-ink-3 transition-transform duration-[180ms]',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** An open row the viewer can change: every way there, to compare. */
export function CompareModes({
  person,
  rights,
}: {
  person: Participant;
  rights: ParticipantRights;
}) {
  const t = useMessages(messages);
  return (
    <>
      <b className="font-semibold text-v2-ink">
        {rights.isSelf ? t.compareYours : t.howIs(person.name)}
      </b>
      <ModePicker person={person} />
    </>
  );
}

/** An open row the viewer can't change: who could. */
export function WhoDecides({ person, rights }: { person: Participant; rights: ParticipantRights }) {
  const t = useMessages(messages);
  const modeLabels = useMessages(travelModeMessages).modes;
  const hostName = useMeetingStore((state) => hostOf(state.currentEvent?.participants)?.name);
  const isPublished = useMeetingStore((state) => !!state.currentEvent?.publishedAt);
  const mode = modeLabels[pickerMode(person.travelMode).ui];
  if (isPublished) {
    return <span>{rights.isSelf ? t.youGoing(mode) : t.going(person.name, mode)}</span>;
  }
  return (
    <span>
      {person.claimable && hostName
        ? t.hostSetThis(hostName, person.name)
        : t.choseThis(person.name)}
    </span>
  );
}

/** Under the venue's trips, where the list isn't showing: the same as the selected row's. */
export function FocusBox({ person }: { person: Participant }) {
  const rights = useParticipantRights(person);
  return (
    <div className="mt-2.5 grid gap-[5px] rounded-xl bg-v2-coral-wash p-2.5 text-[12.5px] text-v2-ink-2">
      {rights.editMode ? (
        <CompareModes person={person} rights={rights} />
      ) : (
        <WhoDecides person={person} rights={rights} />
      )}
    </div>
  );
}
