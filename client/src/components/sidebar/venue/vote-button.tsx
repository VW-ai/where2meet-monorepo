'use client';

import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useMeetingStore } from '@/store/useMeetingStore';
import type { Venue } from '@/types';

interface VoteButtonProps {
  venueId: string;
  voteCount?: number;
  venue?: Venue; // Full venue object for persistent marker data
}

export function VoteButton({ venueId, voteCount = 0, venue }: VoteButtonProps) {
  const { userVotes, voteForVenue, unvoteForVenue } = useMeetingStore();
  const [isAnimating, setIsAnimating] = useState(false);

  const hasVoted = userVotes[venueId] || false;
  const displayCount = hasVoted ? voteCount + 1 : voteCount;

  const handleClick = () => {
    if (hasVoted) {
      unvoteForVenue(venueId);
    } else {
      voteForVenue(venueId, venue);
      // Trigger animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
        hasVoted
          ? 'bg-coral-500 text-white shadow-md hover:bg-coral-600'
          : 'bg-white border-2 border-border text-foreground hover:border-coral-500 hover:bg-coral-50',
        isAnimating && 'scale-110'
      )}
      aria-label={hasVoted ? 'Remove vote' : 'Vote for venue'}
      aria-pressed={hasVoted}
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
