'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import type { Venue } from '@/entities';

interface VoteButtonProps {
  venueId: string;
  voteCount?: number; // Optional fallback - will use backend stats if available
  venue?: Venue; // Full venue object for persistent marker data
}

export function VoteButton({ venueId, voteCount = 0, venue }: VoteButtonProps) {
  const { currentEvent } = useMeetingStore();
  const { hasVotedFor, voteForVenue, unvoteForVenue, voteStatsByVenueId } = useVotingStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasVoted = hasVotedFor(venueId);
  const isPublished = !!currentEvent?.publishedAt;

  // Get vote count from backend statistics (preferred) or use prop as fallback
  // Note: Backend count already includes current user's vote if they voted
  const venueStats = voteStatsByVenueId[venueId];
  const displayCount = venueStats?.voteCount ?? voteCount;

  const handleClick = async () => {
    if (isLoading || isPublished || !currentEvent) return; // Prevent clicks when loading or published

    setIsLoading(true);
    try {
      if (hasVoted) {
        await unvoteForVenue(currentEvent.id, venueId);
      } else {
        if (!venue) {
          console.error('Cannot vote: Venue data is required');
          return;
        }
        await voteForVenue(currentEvent.id, venueId, {
          name: venue.name,
          address: venue.address || undefined,
          lat: venue.location.lat,
          lng: venue.location.lng,
          category: venue.types?.[0] || undefined,
          rating: venue.rating ?? undefined,
          priceLevel: venue.priceLevel ?? undefined,
          photoUrl: venue.photoUrl ?? undefined,
        });
        // Trigger animation on successful vote
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
    } catch (error) {
      // Error is already logged in the store, and optimistic update was reverted
      console.error('Vote button error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || isPublished}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
        isPublished
          ? 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
          : hasVoted
            ? 'bg-coral-500 text-white shadow-md hover:bg-coral-600'
            : 'bg-white border-2 border-border text-foreground hover:border-coral-500 hover:bg-coral-50',
        isAnimating && 'scale-110',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      aria-label={
        isPublished ? 'Voting disabled after publish' : hasVoted ? 'Remove vote' : 'Vote for venue'
      }
      aria-pressed={hasVoted}
      aria-busy={isLoading}
      title={isPublished ? 'Voting is disabled after event is published' : undefined}
    >
      <Heart
        className={cn(
          'w-4 h-4 transition-all duration-200',
          hasVoted && 'fill-white',
          isAnimating && 'scale-125'
        )}
      />
      <span>{displayCount}</span>
    </button>
  );
}
