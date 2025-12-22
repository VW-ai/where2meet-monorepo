'use client';

import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useMeetingStore } from '@/store/useMeetingStore';
import type { Venue } from '@/types';

interface VoteButtonProps {
  venueId: string;
  voteCount?: number; // Optional fallback - will use backend stats if available
  venue?: Venue; // Full venue object for persistent marker data
}

export function VoteButton({ venueId, voteCount = 0, venue }: VoteButtonProps) {
  const { userVotes, voteForVenue, unvoteForVenue, voteStatistics } = useMeetingStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasVoted = userVotes[venueId] || false;

  // Get vote count from backend statistics (preferred) or use prop as fallback
  // Note: Backend count already includes current user's vote if they voted
  const venueStats = voteStatistics?.venues.find((v) => v.id === venueId);
  const displayCount = venueStats?.voteCount ?? voteCount;

  const handleClick = async () => {
    if (isLoading) return; // Prevent multiple simultaneous clicks

    setIsLoading(true);
    try {
      if (hasVoted) {
        await unvoteForVenue(venueId);
      } else {
        await voteForVenue(venueId, venue);
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
      disabled={isLoading}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
        hasVoted
          ? 'bg-coral-500 text-white shadow-md hover:bg-coral-600'
          : 'bg-white border-2 border-border text-foreground hover:border-coral-500 hover:bg-coral-50',
        isAnimating && 'scale-110',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      aria-label={hasVoted ? 'Remove vote' : 'Vote for venue'}
      aria-pressed={hasVoted}
      aria-busy={isLoading}
    >
      <ThumbsUp
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
