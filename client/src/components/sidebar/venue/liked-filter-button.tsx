'use client';

import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useMeetingStore } from '@/store/useMeetingStore';

interface LikedFilterButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function LikedFilterButton({ isExpanded, onToggle }: LikedFilterButtonProps) {
  const { savedVenues } = useMeetingStore();

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
        'shadow-md hover:shadow-lg',
        isExpanded
          ? 'bg-coral-500 text-white border-2 border-coral-500 hover:bg-coral-600'
          : 'bg-white/90 backdrop-blur-sm text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50'
      )}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} liked venues filter${savedVenues.length > 0 ? ` (${savedVenues.length})` : ''}`}
    >
      <Heart className={cn('w-4 h-4 flex-shrink-0', isExpanded && 'fill-white')} />
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
