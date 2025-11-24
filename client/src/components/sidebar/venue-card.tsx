'use client';

import { useMeetingStore } from '@/store/useMeetingStore';
import type { Venue } from '@/types';
import { MapPin, Star, Clock } from 'lucide-react';

interface VenueCardProps {
  venue: Venue;
}

export function VenueCard({ venue }: VenueCardProps) {
  const { selectedVenue, setSelectedVenue } = useMeetingStore();
  const isSelected = selectedVenue?.id === venue.id;

  const handleClick = () => {
    // Toggle venue selection
    if (isSelected) {
      setSelectedVenue(null);
    } else {
      setSelectedVenue(venue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`
        p-4 rounded-xl
        ${isSelected ? 'bg-coral-50/90 backdrop-blur-sm shadow-xl ring-2 ring-coral-500/30' : 'bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl'}
        transition-all duration-200 cursor-pointer
        group
        focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2
      `}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
    >
      {/* Venue Name */}
      <h3 className="font-semibold text-foreground group-hover:text-coral-500 transition-colors">
        {venue.name}
      </h3>

      {/* Address */}
      <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="line-clamp-2">{venue.address}</span>
      </div>

      {/* Rating */}
      {venue.rating && (
        <div className="flex items-center gap-1.5 mt-2">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium text-foreground">{venue.rating.toFixed(1)}</span>
        </div>
      )}

      {/* Open Hours Status */}
      {venue.openNow !== null && venue.openNow !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span
            className={`text-xs font-medium ${venue.openNow ? 'text-mint-600' : 'text-red-600'}`}
          >
            {venue.openNow ? 'Open now' : 'Closed'}
          </span>
        </div>
      )}

      {/* Category Badge */}
      <div className="flex flex-wrap gap-1 mt-3">
        <span className="px-2 py-0.5 text-xs rounded-full bg-coral-50 text-coral-700 capitalize">
          {venue.category.replace('_', ' ')}
        </span>
        {venue.priceLevel && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-mint-50 text-mint-700">
            {'$'.repeat(venue.priceLevel)}
          </span>
        )}
      </div>
    </div>
  );
}
