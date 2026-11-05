'use client';

import { useEffect, useState } from 'react';
import { Heart, Navigation, Share } from 'lucide-react';
import type { Venue } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { isPublished } from '@/features/invitation/model/invitation';
import {
  organizerDisplayName,
  venueFooterState,
  type ViewerRole,
} from '@/features/meeting/lib/venue-footer';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { publishErrorMessage, publishVenue } from '@/features/meeting/model/publish-venue';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { venueVoteData } from '@/features/voting/model/venue-vote-data';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { venueMapsUrl } from '@/shared/lib/map-provider';
import { SlideToLock } from './slide-to-lock';
import { BUTTON } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    join: 'Join to like spots',
    directions: 'Directions',
    like: 'Like',
    liked: 'Liked',
    picksFinal: (name: string) => `${name} picks the final spot.`,
    organizerPicksFinal: 'The organizer picks the final spot.',
    lockNote: "Everyone sees it right away, and new people can't join. You can change it later.",
    share: 'Share invite',
    goingTo: (venue: string) => `The group is going to ${venue}.`,
    goingElsewhere: 'The group picked another spot.',
    seeSpot: 'See the spot',
  },
  zh: {
    join: '加入后才能喜欢地点',
    directions: '导航',
    like: '喜欢',
    liked: '已喜欢',
    picksFinal: (name: string) => `${name}来定最终地点。`,
    organizerPicksFinal: '发起人来定最终地点。',
    lockNote: '所有人会马上看到，新成员也不能再加入。之后还可以更换。',
    share: '分享邀请',
    goingTo: (venue: string) => `大家要去${venue}。`,
    goingElsewhere: '大家选了别的地点。',
    seeSpot: '查看地点',
  },
});

function useVenueLike(venue: Venue) {
  const { currentEvent } = useMeetingStore();
  const { hasVotedFor, voteForVenue, unvoteForVenue, voteStatsByVenueId } = useVotingStore();
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const liked = hasVotedFor(venue.id);

  const toggle = async () => {
    if (!currentEvent || busy) return;
    setBusy(true);
    try {
      if (liked) {
        await unvoteForVenue(currentEvent.id, venue.id);
      } else {
        await voteForVenue(currentEvent.id, venue.id, venueVoteData(venue));
        setBurst(true);
      }
    } catch (error) {
      // The store has already put the vote back
      console.error('Failed to toggle venue like:', error);
    } finally {
      setBusy(false);
    }
  };

  return {
    liked,
    count: voteStatsByVenueId[venue.id]?.voteCount ?? 0,
    busy,
    burst,
    toggle,
    endBurst: () => setBurst(false),
  };
}

function viewerRole(isOrganizer: boolean, isParticipant: boolean): ViewerRole {
  if (isOrganizer) return 'organizer';
  return isParticipant ? 'participant' : 'visitor';
}

/** Mounted once per venue (keyed by id), so a half-finished slide never follows you to the next one. */
export function VenuePanelFooter({ venue }: { venue: Venue }) {
  const t = useMessages(messages);
  const locale = useLocale();
  const { currentEvent, venueById, setSelectedVenue, hydrateVenue } = useMeetingStore();
  const { closeVenueInfo, openVenueInfo, openShareModal, requestJoinForm } = useUIStore();
  const { isOrganizerMode, isParticipantMode, organizerToken } = useAuthStore();
  const like = useVenueLike(venue);
  const [error, setError] = useState<string | null>(null);

  const publishedVenueId =
    currentEvent && isPublished(currentEvent) ? currentEvent.publishedVenueId : null;
  const state = venueFooterState({
    venueId: venue.id,
    publishedVenueId,
    role: viewerRole(isOrganizerMode, isParticipantMode),
  });

  useEffect(() => {
    if (publishedVenueId) hydrateVenue(publishedVenueId);
  }, [publishedVenueId, hydrateVenue]);

  const openDirections = () => {
    window.open(
      venueMapsUrl(currentEvent?.mapProvider ?? 'google', venue),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const directionsButton = (
    <button type="button" className={BUTTON.line} onClick={openDirections}>
      <Navigation aria-hidden="true" />
      {t.directions}
    </button>
  );

  const likeButton = (grow: boolean) => (
    <button
      type="button"
      className={cn(
        like.liked ? BUTTON.liked : BUTTON.like,
        grow && 'flex-1',
        like.burst && 'like-burst'
      )}
      onClick={like.toggle}
      onAnimationEnd={like.endBurst}
      disabled={like.busy}
      aria-pressed={like.liked}
    >
      <Heart aria-hidden="true" />
      {like.liked ? t.liked : t.like}
      {like.count > 0 && ` · ${like.count}`}
    </button>
  );

  const lockIn = async () => {
    if (!currentEvent || !organizerToken) return false;
    setError(null);
    try {
      await publishVenue(currentEvent.id, venue, organizerToken);
      return true;
    } catch (err) {
      setError(publishErrorMessage(err, locale));
      return false;
    }
  };

  const body = () => {
    switch (state.kind) {
      case 'join':
        return (
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(BUTTON.ink, 'flex-1')}
              onClick={() => {
                closeVenueInfo();
                requestJoinForm();
              }}
            >
              {t.join}
            </button>
            {directionsButton}
          </div>
        );
      case 'like': {
        const organizer = organizerDisplayName(currentEvent?.participants ?? []);
        return (
          <>
            <div className="flex gap-2">
              {likeButton(true)}
              {directionsButton}
            </div>
            <p className="text-center text-[12.5px] text-v2-ink-2">
              {organizer ? t.picksFinal(organizer) : t.organizerPicksFinal}
            </p>
          </>
        );
      }
      case 'pick':
        return (
          <>
            <div className="flex gap-2">
              {likeButton(true)}
              {directionsButton}
            </div>
            {error && (
              <p role="alert" className="text-center text-[12.5px] text-v2-coral-deep">
                {error}
              </p>
            )}
            <SlideToLock venueName={venue.name} onLock={lockIn} />
            <p className="text-center text-xs text-v2-ink-3">{t.lockNote}</p>
          </>
        );
      case 'share':
        return (
          <div className="flex gap-2">
            <button type="button" className={cn(BUTTON.radiant, 'flex-1')} onClick={openShareModal}>
              <Share aria-hidden="true" />
              {t.share}
            </button>
            {directionsButton}
          </div>
        );
      case 'elsewhere': {
        const spot = venueById[state.spotId];
        return (
          <>
            <p className="text-center text-[12.5px] text-v2-ink-2">
              {spot ? t.goingTo(spot.name) : t.goingElsewhere}
            </p>
            <button
              type="button"
              className={cn(BUTTON.line, 'w-full')}
              disabled={!spot}
              onClick={() => {
                setSelectedVenue(spot);
                openVenueInfo(spot.id);
              }}
            >
              {t.seeSpot}
            </button>
          </>
        );
      }
    }
  };

  return (
    <div className="flex flex-none flex-col gap-2 border-t border-v2-line px-[18px] pb-3.5 pt-3">
      {body()}
    </div>
  );
}
