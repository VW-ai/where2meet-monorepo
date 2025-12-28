'use client';

import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useVotingStore } from '@/features/voting/model/voting-store';

interface LikedFilterButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function LikedFilterButton({
  isExpanded,
  onToggle,
  disabled = false,
}: LikedFilterButtonProps) {
  const { getAllVotedVenueIds, voteStatsByVenueId } = useVotingStore();

  // Subscribe to vote changes to re-render when votes update
  const savedVenues = useMemo(() => {
    return getAllVotedVenueIds();
  }, [voteStatsByVenueId, getAllVotedVenueIds]);

  return (
    <button
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative',
        'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
        'shadow-md hover:shadow-lg',
        isExpanded
          ? 'bg-coral-500 text-white border-2 border-coral-500 hover:bg-coral-600'
          : 'bg-white/90 backdrop-blur-sm text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50',
        disabled &&
          'cursor-not-allowed opacity-80 hover:shadow-md hover:border-border hover:bg-white/90'
      )}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} liked venues filter${savedVenues.length > 0 ? ` (${savedVenues.length})` : ''}`}
    >
      <Heart className={cn('w-4 h-4 flex-shrink-0', isExpanded && 'fill-white')} />
      {/* Show count badge when collapsed */}
      {!isExpanded && savedVenues.length > 0 && (
        <span className="absolute -top-1 -right-1 px-1.5 min-w-[20px] h-5 flex items-center justify-center text-xs font-semibold rounded-full bg-coral-500 text-white border-2 border-white">
          {savedVenues.length}
        </span>
      )}
      {/* Show text when expanded */}
      {isExpanded && (
        <>
          <span className="whitespace-nowrap">Liked</span>
          {savedVenues.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-white text-coral-700 whitespace-nowrap">
              {savedVenues.length}
            </span>
          )}
        </>
      )}
    </button>
  );
}
