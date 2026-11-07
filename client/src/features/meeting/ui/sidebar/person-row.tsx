'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart, MapPin } from 'lucide-react';
import type { Participant } from '@/entities';
import { useClaimParticipant } from '@/features/meeting/hooks/useParticipantActions';
import { formatTripTime } from '@/features/meeting/lib/route-summary';
import { scrollToReveal } from '@/features/meeting/lib/scroll-to-reveal';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { prefersReducedMotion } from '../map/map-motion';
import { PersonDetailsEditor } from './person-details-editor';
import {
  CompareModes,
  HowLine,
  RowTagBadge,
  useParticipantRights,
  WhoDecides,
} from './transport-parts';
import { BUTTON, BUTTON_SMALL, ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    you: 'You',
    addLocation: 'Add starting location',
    noLikes: 'No likes yet',
    edit: 'Edit',
    remove: 'Remove',
    removeNamed: (name: string) => `Remove ${name}`,
    leave: 'Leave',
    thatsMe: "That's me",
  },
  zh: {
    you: '我',
    addLocation: '添加出发地点',
    noLikes: '还没有喜欢的地点',
    edit: '编辑',
    remove: '移除',
    removeNamed: (name: string) => `移除${name}`,
    leave: '退出',
    thatsMe: '这是我',
  },
});

const LINK =
  'text-xs text-v2-ink-2 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink';

function LikedSpots({ participantId }: { participantId: string }) {
  const t = useMessages(messages);
  const { voteStatsByVenueId } = useVotingStore();
  const venueById = useMeetingStore((state) => state.venueById);
  const names = Object.entries(voteStatsByVenueId).flatMap(([venueId, stats]) => {
    const name = venueById[venueId]?.name;
    return name && stats.voterIds.includes(participantId) ? [name] : [];
  });
  return (
    <div className="mt-[3px] flex items-center gap-1 whitespace-nowrap text-xs text-v2-ink-3">
      {names.length > 0 ? (
        <>
          <Heart className="size-3 flex-none fill-v2-coral text-v2-coral" aria-hidden="true" />
          <span className="truncate">{names.join(', ')}</span>
        </>
      ) : (
        <span>{t.noLikes}</span>
      )}
    </div>
  );
}

// A row that opens near the edge of the list, or was just added, should end up in full view.
// Only the list moves: an ancestor that merely clips can still be scrolled, and must not be.
const SHEET_RESIZE_MS = 240;

function revealInList(row: HTMLElement) {
  let list = row.parentElement;
  while (list && !/auto|scroll/.test(getComputedStyle(list).overflowY)) list = list.parentElement;
  if (!list) return;
  const top = scrollToReveal(
    row.getBoundingClientRect(),
    list.getBoundingClientRect(),
    window.innerWidth >= 768
  );
  if (top !== 0) {
    list.scrollBy({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

export function PersonRow({ person, onRemove }: { person: Participant; onRemove: () => void }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const rights = useParticipantRights(person);
  const claim = useClaimParticipant();
  const [claiming, setClaiming] = useState(false);
  const [editing, setEditing] = useState(false);
  const askingForMyStart = rights.isSelf && rights.editDetails && !person.address;
  const { selectedParticipantId, setSelectedParticipantId, routes } = useMapStore();
  const hasVenue = useMeetingStore((state) => !!state.selectedVenue);
  const selected = selectedParticipantId === person.id;
  const route = hasVenue
    ? routes.find((r) => r.participantId === person.id && r.travelMode === person.travelMode)
    : undefined;

  const rowRef = useRef<HTMLDivElement>(null);
  const open = selected || editing;
  useEffect(() => {
    const row = rowRef.current;
    if (!open || !row) return;
    revealInList(row);
    // Closing the add form shrinks a phone's sheet, and this list with it
    const settled = setTimeout(() => revealInList(row), SHEET_RESIZE_MS);
    return () => clearTimeout(settled);
  }, [open]);

  const toggle = () => setSelectedParticipantId(selected ? null : person.id);
  const quiet = (run: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    run();
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-expanded={selected}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      }}
      className={cn(
        'grid cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-sm text-v2-ink',
        open || askingForMyStart ? 'bg-v2-coral-wash' : 'hover:bg-v2-wash',
        (editing || askingForMyStart) && 'shadow-[inset_0_0_0_1.5px_#ffc9c7]'
      )}
    >
      <ParticipantAvatar participant={person} large />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
          <span className="truncate">{rights.isSelf ? t.you : person.name}</span>
          {rights.tag && <RowTagBadge tag={rights.tag} />}
        </div>
        <HowLine person={person} open={selected} expandable={rights.editMode} />
        {!person.claimable && <LikedSpots participantId={person.id} />}
        {!person.address && rights.editDetails && !rights.isSelf && !editing && (
          <button
            type="button"
            onClick={quiet(() => setEditing(true))}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-v2-coral-deep hover:underline"
          >
            <MapPin className="size-3 flex-none" aria-hidden="true" />
            {t.addLocation}
          </button>
        )}
        {rights.claim && (
          <button
            type="button"
            disabled={claiming}
            className={cn(BUTTON.radiant, BUTTON_SMALL, 'mt-1.5')}
            onClick={quiet(() => {
              setClaiming(true);
              void claim(person).finally(() => setClaiming(false));
            })}
          >
            {t.thatsMe}
          </button>
        )}
      </div>
      {route ? (
        <span className="text-right text-xs leading-tight tabular-nums text-v2-ink-2">
          <strong className="block whitespace-nowrap text-sm font-semibold text-v2-ink">
            {formatTripTime(route.durationSeconds, locale)}
          </strong>
          {route.distance}
        </span>
      ) : (
        <span />
      )}
      {editing ? (
        <PersonDetailsEditor
          person={person}
          isSelf={rights.isSelf}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        askingForMyStart && <PersonDetailsEditor person={person} isSelf />
      )}
      {selected && !editing && (
        <div
          className="col-span-full grid cursor-default gap-1.5 text-[12.5px] text-v2-ink-2"
          onClick={(event) => event.stopPropagation()}
        >
          {rights.editMode ? (
            <CompareModes person={person} rights={rights} />
          ) : (
            <WhoDecides person={person} rights={rights} />
          )}
          {((rights.editDetails && !askingForMyStart) || rights.remove) && (
            <div className="flex gap-2.5">
              {rights.editDetails && !askingForMyStart && (
                <button type="button" className={LINK} onClick={quiet(() => setEditing(true))}>
                  {t.edit}
                </button>
              )}
              {rights.remove && (
                <button type="button" className={LINK} onClick={quiet(onRemove)}>
                  {rights.isSelf
                    ? t.leave
                    : person.claimable
                      ? t.removeNamed(person.name)
                      : t.remove}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
