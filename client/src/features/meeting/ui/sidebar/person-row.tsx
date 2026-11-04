'use client';

import { useState } from 'react';
import { Heart, MapPin } from 'lucide-react';
import type { Participant } from '@/entities';
import { useClaimParticipant } from '@/features/meeting/hooks/useParticipantActions';
import { formatTripTime } from '@/features/meeting/lib/route-summary';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { ModeLine, ModePicker, RowTagBadge, useParticipantRights } from './transport-parts';
import { BUTTON, BUTTON_SMALL, ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    you: 'You',
    from: (place: string) => `From ${place}`,
    addLocation: 'Add starting location',
    noLikes: 'No likes yet',
    edit: 'Edit',
    remove: 'Remove',
    leave: 'Leave',
    thatsMe: "That's me",
  },
  zh: {
    you: '我',
    from: (place: string) => `从${place}出发`,
    addLocation: '添加出发地点',
    noLikes: '还没有喜欢的地点',
    edit: '编辑',
    remove: '移除',
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

export function PersonRow({
  person,
  onEdit,
  onRemove,
  onAddLocation,
}: {
  person: Participant;
  onEdit: () => void;
  onRemove: () => void;
  onAddLocation?: () => void;
}) {
  const t = useMessages(messages);
  const locale = useLocale();
  const rights = useParticipantRights(person);
  const claim = useClaimParticipant();
  const [claiming, setClaiming] = useState(false);
  const { selectedParticipantId, setSelectedParticipantId, routes } = useMapStore();
  const hasVenue = useMeetingStore((state) => !!state.selectedVenue);
  const selected = selectedParticipantId === person.id;
  const route = hasVenue
    ? routes.find((r) => r.participantId === person.id && r.travelMode === person.travelMode)
    : undefined;

  const toggle = () => setSelectedParticipantId(selected ? null : person.id);
  const quiet = (run: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    run();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      }}
      className={cn(
        'grid cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-sm text-v2-ink',
        selected ? 'bg-v2-coral-wash' : 'hover:bg-v2-wash'
      )}
    >
      <ParticipantAvatar participant={person} large />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
          <span className="truncate">{rights.isSelf ? t.you : person.name}</span>
          {rights.tag && <RowTagBadge tag={rights.tag} />}
        </div>
        {rights.editMode ? (
          <ModePicker person={person} compare={selected} />
        ) : (
          <ModeLine person={person} />
        )}
        {rights.editMode && person.address && (
          <div className="mt-[3px] truncate text-xs text-v2-ink-3">{t.from(person.address)}</div>
        )}
        {!person.claimable && <LikedSpots participantId={person.id} />}
        {!person.address && onAddLocation && (
          <button
            type="button"
            onClick={quiet(onAddLocation)}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-v2-coral-deep hover:underline"
          >
            <MapPin className="size-3 flex-none" aria-hidden="true" />
            {t.addLocation}
          </button>
        )}
        {(rights.editDetails || rights.remove) && (
          <div className="mt-1 flex gap-2.5">
            {rights.editDetails && (
              <button type="button" className={LINK} onClick={quiet(onEdit)}>
                {t.edit}
              </button>
            )}
            {rights.remove && (
              <button type="button" className={LINK} onClick={quiet(onRemove)}>
                {rights.isSelf ? t.leave : t.remove}
              </button>
            )}
          </div>
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
      {route && (
        <span className="text-right text-xs leading-tight tabular-nums text-v2-ink-2">
          <strong className="block whitespace-nowrap text-sm font-semibold text-v2-ink">
            {formatTripTime(route.durationSeconds, locale)}
          </strong>
          {route.distance}
        </span>
      )}
    </div>
  );
}
