'use client';

import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import type { Venue } from '@/entities';
import { MapPin, Star, Clock, Crown } from 'lucide-react';
import { VoteButton } from '@/features/voting/ui/vote-button';

interface VenueCardProps {
  venue: Venue;
  isPublishedVenue?: boolean;
}

export function VenueCard({ venue, isPublishedVenue = false }: VenueCardProps) {
  const { selectedVenue, setSelectedVenue } = useMeetingStore();
  const { openVenueInfo } = useUIStore();
  const { setHoveredVenueId } = useMapStore();
  const isSelected = selectedVenue?.id === venue.id;

  // Ref for scroll-to-view behavior
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll card into view when selected from map
  useEffect(() => {
    if (isSelected && cardRef.current) {
      const timeoutId = setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isSelected]);

  const handleClick = () => {
    // Select venue on map and open details slide-out
    setSelectedVenue(venue);
    openVenueInfo(venue.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`
        p-4 rounded-xl relative
        ${
          isPublishedVenue
            ? 'bg-gradient-to-br from-yellow-50 to-amber-50/90 backdrop-blur-sm shadow-xl ring-2 ring-yellow-500/50'
            : isSelected
              ? 'bg-coral-50/90 backdrop-blur-sm shadow-xl ring-2 ring-coral-500/30'
              : 'bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl'
        }
        transition-all duration-200 cursor-pointer
        group
        focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2
      `}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHoveredVenueId(venue.id)}
      onMouseLeave={() => setHoveredVenueId(null)}
      aria-pressed={isSelected}
    >
      {/* Published Venue Crown Badge */}
      {isPublishedVenue && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full p-2 shadow-lg ring-2 ring-white">
          <Crown className="w-4 h-4 text-white fill-white" />
        </div>
      )}

      {/* Venue Name */}
      <h3
        className={`font-semibold transition-colors ${
          isPublishedVenue ? 'text-amber-900' : 'text-foreground group-hover:text-coral-500'
        }`}
      >
        {venue.name}
        {isPublishedVenue && (
          <span className="ml-2 text-xs font-medium text-amber-700 bg-yellow-100 px-2 py-0.5 rounded-full">
            Published
          </span>
        )}
      </h3>

      {/* Address */}
      <div className="flex items-start gap-2 mt-1.5 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="line-clamp-1">{venue.address}</span>
      </div>

      {/* Rating, Status, Price & Like Button - all on one line */}
      <div
        className="flex items-center justify-between mt-3 pt-2 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Left side - Rating, Status, Price */}
        <div className="flex items-center gap-3">
          {/* Rating */}
          {venue.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium text-foreground">{venue.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Open Status */}
          {venue.openNow !== null && venue.openNow !== undefined && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span
                className={`text-xs font-medium ${venue.openNow ? 'text-mint-600' : 'text-red-600'}`}
              >
                {venue.openNow ? 'Open' : 'Closed'}
              </span>
            </div>
          )}

          {/* Price Level */}
          {venue.priceLevel && (
            <span className="text-xs font-medium text-muted-foreground">
              {'$'.repeat(venue.priceLevel)}
            </span>
          )}
        </div>

        {/* Right side - Like Button */}
        <VoteButton venueId={venue.id} voteCount={venue.voteCount} venue={venue} />
      </div>
    </div>
  );
}
