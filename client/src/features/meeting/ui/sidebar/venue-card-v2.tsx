'use client';

import { useEffect, useRef } from 'react';
import { Coffee, Star, Store, Utensils, Wine } from 'lucide-react';
import { topLikedVenueId, venueLikes } from '@/features/meeting/lib/venue-list';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import type { VenueCardProps } from './venue-card';
import { AvatarStack, ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    top: 'TOP',
    theSpot: 'THE SPOT',
    open: 'Open',
    closed: 'Closed',
    noLikes: 'No likes yet',
    likeCount: (n: number, total: number) => `${n} of ${total}`,
  },
  zh: {
    top: '热门',
    theSpot: '已定',
    open: '营业中',
    closed: '已打烊',
    noLikes: '还没有人喜欢',
    likeCount: (n: number, total: number) => `${n} / ${total} 人`,
  },
});

const TAG = 'flex-none rounded-full px-1.5 py-px font-v2-mono text-[9.5px] font-medium';

export function VenueCardV2({ venue, isPublishedVenue = false }: VenueCardProps) {
  const t = useMessages(messages);
  const { selectedVenue, setSelectedVenue, currentEvent } = useMeetingStore();
  const { openVenueInfo } = useUIStore();
  const { setHoveredVenueId } = useMapStore();
  const { voteStatsByVenueId } = useVotingStore();
  const isSelected = selectedVenue?.id === venue.id;
  const rowRef = useRef<HTMLButtonElement>(null);

  const participants = currentEvent?.participants ?? [];
  const { voters, total } = venueLikes(
    voteStatsByVenueId[venue.id]?.voterIds ?? [],
    participants,
    null
  );
  const isTop = topLikedVenueId(voteStatsByVenueId) === venue.id;

  const VenueIcon = venue.types.includes('cafe')
    ? Coffee
    : venue.types.includes('restaurant')
      ? Utensils
      : venue.types.includes('bar')
        ? Wine
        : Store;

  // Picked on the map: bring the row into view. The published row leaves the scroll to the ticket.
  useEffect(() => {
    if (!isSelected || isPublishedVenue) return;
    const timeoutId = setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [isSelected, isPublishedVenue]);

  return (
    <button
      ref={rowRef}
      type="button"
      aria-pressed={isSelected}
      onClick={() => {
        setSelectedVenue(venue);
        openVenueInfo(venue.id);
      }}
      onMouseEnter={() => setHoveredVenueId(venue.id)}
      onMouseLeave={() => setHoveredVenueId(null)}
      className={cn(
        'grid w-full grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left text-sm text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink',
        isSelected ? 'bg-v2-coral-wash' : 'hover:bg-v2-wash'
      )}
    >
      <span className="grid size-12 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#b07a4a] to-[#6b3a2a] text-white">
        {venue.photoUrl ? (
          <img src={venue.photoUrl} alt="" className="block size-full object-cover" />
        ) : (
          <VenueIcon className="size-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <b className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap font-semibold">
          <span className="truncate">{venue.name}</span>
          {isPublishedVenue ? (
            <span className={cn(TAG, 'bg-v2-ticket text-white')}>{t.theSpot}</span>
          ) : (
            isTop && <span className={cn(TAG, 'bg-v2-coral-wash text-v2-coral-deep')}>{t.top}</span>
          )}
        </b>
        <small className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-v2-ink-2">
          {venue.rating != null && (
            <span className="inline-flex items-center gap-[3px]">
              <Star className="size-3 fill-[#f5b301] text-[#f5b301]" aria-hidden="true" />
              {venue.rating.toFixed(1)}
            </span>
          )}
          {venue.openNow != null && (
            <span
              className={cn('font-medium', venue.openNow ? 'text-v2-mint' : 'text-v2-coral-deep')}
            >
              {venue.openNow ? t.open : t.closed}
            </span>
          )}
          {!!venue.priceLevel && <span>{'$'.repeat(venue.priceLevel)}</span>}
        </small>
        <small className="mt-[3px] flex min-h-[18px] items-center gap-1 text-xs text-v2-ink-2">
          {voters.length > 0 ? (
            <>
              <AvatarStack>
                {voters.map((p) => (
                  <ParticipantAvatar key={p.id} participant={p} small />
                ))}
              </AvatarStack>
              {t.likeCount(voters.length, total)}
            </>
          ) : (
            t.noLikes
          )}
        </small>
      </span>
    </button>
  );
}
