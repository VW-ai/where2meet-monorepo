'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Star,
  MapPin,
  Clock,
  Phone,
  Globe,
  ExternalLink,
  Heart,
  Loader2,
  Car,
  Train,
  Footprints,
  Bike,
  BarChart3,
} from 'lucide-react';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { venueClient } from '@/features/meeting/api';
import { getVenueCategoryDisplay } from '@/entities';
import type { Venue } from '@/entities';
import { cn } from '@/shared/lib/cn';
import { VoteButton } from '@/features/voting/ui/vote-button';

// Helper to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Travel mode icons mapping
const TravelModeIcon = ({ mode }: { mode: string }) => {
  const iconClass = 'w-3.5 h-3.5';
  switch (mode) {
    case 'transit':
      return <Train className={iconClass} />;
    case 'walk':
      return <Footprints className={iconClass} />;
    case 'bike':
      return <Bike className={iconClass} />;
    default:
      return <Car className={iconClass} />;
  }
};

export function VenueInfo() {
  const { isVenueInfoOpen, selectedVenueId, closeVenueInfo } = useUIStore();
  const { selectedVenue, currentEvent, setSelectedVenue } = useMeetingStore();
  const { voteForVenue, unvoteForVenue, hasVotedFor } = useVotingStore();
  const { routes, isCalculatingRoutes, travelMode } = useMapStore();
  const { organizerParticipantId, currentParticipantId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [venueDetails, setVenueDetails] = useState<Partial<Venue> | null>(null);

  // Get current user's participant ID (organizer takes precedence)
  const myParticipantId = organizerParticipantId || currentParticipantId;

  // Get participants from current event, sorted with current user first
  const participants = currentEvent?.participants || [];
  const sortedParticipants = [...participants].sort((a, b) => {
    // Current user always comes first
    if (a.id === myParticipantId) return -1;
    if (b.id === myParticipantId) return 1;
    // Others maintain their original order
    return 0;
  });

  // Helper to get travel time for a participant
  const getTravelInfo = (participantId: string) => {
    const route = routes.find((r) => r.participantId === participantId);
    return route ? { duration: route.duration, distance: route.distance } : null;
  };

  // Merge selected venue with fetched details
  const venue = selectedVenue ? { ...selectedVenue, ...venueDetails } : null;

  // Fetch additional venue details when venue info is opened
  useEffect(() => {
    if (!selectedVenueId || !isVenueInfoOpen || !selectedVenue) {
      setVenueDetails(null);
      return;
    }

    // Store selectedVenue in a const to ensure TypeScript knows it's not null
    const venueToFetch = selectedVenue;

    async function fetchVenueDetails() {
      setLoading(true);
      try {
        // Fetch detailed information from backend API
        const details = await venueClient.get(venueToFetch.id);
        setVenueDetails(details);
      } catch (error) {
        console.error('Failed to fetch venue details:', error);
        // Continue with basic venue info even if details fetch fails
      } finally {
        setLoading(false);
      }
    }

    fetchVenueDetails();
  }, [selectedVenueId, isVenueInfoOpen, selectedVenue]);

  // Handle closing - clears both panel and selected venue (which clears routes)
  const handleClose = () => {
    closeVenueInfo();
    setSelectedVenue(null);
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVenueInfoOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVenueInfoOpen]);

  const handleOpenInMaps = () => {
    if (!venue) return;

    // Open Google Maps with venue location
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}&query_place_id=${venue.id}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggleSave = async () => {
    if (!venue || !currentEvent) return;
    const isSaved = hasVotedFor(venue.id);

    try {
      if (isSaved) {
        await unvoteForVenue(currentEvent.id, venue.id);
      } else {
        // Vote for the venue (which persists it with full data)
        await voteForVenue(currentEvent.id, venue.id, {
          name: venue.name,
          address: venue.address || undefined,
          lat: venue.location.lat,
          lng: venue.location.lng,
          category: venue.types?.[0] || undefined,
          rating: venue.rating ?? undefined,
          priceLevel: venue.priceLevel ?? undefined,
          photoUrl: venue.photoUrl ?? undefined,
        });
      }
    } catch (error) {
      console.error('Failed to toggle venue save:', error);
    }
  };

  const isSaved = venue ? hasVotedFor(venue.id) : false;

  return (
    <aside
      className={cn(
        // Mobile: match sidebar height (50vh from bottom)
        'fixed bottom-0 left-0 right-0 h-[50vh] w-full',
        // Desktop: match sidebar positioning and size
        'md:absolute md:top-[10vh] md:bottom-3 md:h-auto md:max-h-[calc(90vh-1rem)]',
        'md:left-[calc(320px+24px)] lg:left-[calc(360px+24px)] xl:left-[calc(400px+24px)]',
        'md:w-[320px] lg:w-[360px] xl:w-[400px]',
        'md:right-auto',
        // Styling
        'bg-white/95 backdrop-blur-md shadow-2xl z-40',
        'border-t md:border-t-0 md:border-l border-border/50',
        'rounded-t-2xl md:rounded-2xl',
        'overflow-y-auto',
        'transition-opacity duration-300 ease-in-out',
        isVenueInfoOpen ? 'opacity-100' : 'opacity-0',
        !isVenueInfoOpen && 'pointer-events-none'
      )}
      role="complementary"
      aria-labelledby="venue-info-title"
    >
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-coral-500 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading venue details...</p>
          </div>
        </div>
      )}

      {/* Venue Details */}
      {!loading && venue && (
        <>
          {/* Header Image with Title Overlay */}
          <div className="relative h-64 bg-gradient-to-br from-sky-100 via-coral-50 to-mint-50">
            {venue.photoUrl ? (
              <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <MapPin className="w-16 h-16 text-coral-300" />
              </div>
            )}

            {/* Gradient Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-coral-500 z-10"
              aria-label="Close venue details"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>

            {/* Like/Save Button */}
            <button
              onClick={handleToggleSave}
              className={cn(
                'absolute top-4 left-4 p-2 rounded-full backdrop-blur-sm shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-coral-500 z-10',
                isSaved
                  ? 'bg-coral-500 text-white hover:bg-coral-600'
                  : 'bg-white/90 hover:bg-white text-foreground'
              )}
              aria-label={isSaved ? 'Remove from saved' : 'Save venue'}
            >
              <Heart className={cn('w-5 h-5', isSaved && 'fill-current')} />
            </button>

            {/* Title and Rating Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <h2
                id="venue-info-title"
                className="text-2xl font-bold text-white mb-2 drop-shadow-lg"
              >
                {venue.name}
              </h2>
              {venue.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold text-foreground">
                      {venue.rating.toFixed(1)}
                    </span>
                  </div>
                  {/* Interactive vote button - syncs with backend */}
                  <VoteButton venueId={venue.id} voteCount={venue.voteCount} venue={venue} />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Category Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-coral-50 text-coral-700 text-sm font-medium capitalize">
              {getVenueCategoryDisplay(venue)}
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-coral-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Address</p>
                <p className="text-sm text-muted-foreground">{venue.address}</p>
              </div>
            </div>

            {/* Travel Times Section - only show when routes are available */}
            {participants.length > 0 && routes.length > 0 && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Travel Times</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      <TravelModeIcon mode={travelMode} />
                      <span className="capitalize">{travelMode}</span>
                    </div>
                  </div>
                  <button
                    className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500"
                    aria-label="View travel statistics"
                    title="Travel Statistics"
                  >
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-2">
                  {isCalculatingRoutes ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-coral-500 animate-spin" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Calculating routes...
                      </span>
                    </div>
                  ) : (
                    <>
                      {sortedParticipants.slice(0, 5).map((participant) => {
                        const travelInfo = getTravelInfo(participant.id);
                        const isCurrentUser = participant.id === myParticipantId;
                        return (
                          <div
                            key={participant.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl transition-colors',
                              isCurrentUser
                                ? 'bg-coral-100/60 ring-2 ring-coral-300/50 hover:bg-coral-100/80'
                                : 'bg-muted/30 hover:bg-muted/50'
                            )}
                          >
                            {/* Participant info */}
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Avatar */}
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                                  participant.color || 'bg-gray-400'
                                )}
                              >
                                {getInitials(participant.name)}
                              </div>
                              {/* Name */}
                              <span className="text-sm font-medium text-foreground truncate">
                                {participant.name}
                                {isCurrentUser && (
                                  <span className="ml-1.5 text-xs text-coral-600 font-semibold">
                                    (You)
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Travel time */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {travelInfo ? (
                                <>
                                  <div
                                    className={cn(
                                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                                      isCurrentUser
                                        ? 'bg-coral-600 text-white'
                                        : 'bg-coral-500 text-white'
                                    )}
                                  >
                                    <Clock className="w-3 h-3" />
                                    <span className="text-xs font-medium">
                                      {travelInfo.duration}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {travelInfo.distance}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  No route
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {sortedParticipants.length > 5 && (
                        <div className="flex items-center justify-center p-2">
                          <span className="text-xs text-muted-foreground italic">
                            +{sortedParticipants.length - 5} more participants...
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Opening Hours */}
            {venue.openingHours && venue.openingHours.length > 0 && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-coral-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-2">Hours</p>
                  <div className="space-y-1">
                    {venue.openingHours.map((hours, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        {hours}
                      </p>
                    ))}
                  </div>
                  {venue.openNow !== undefined && (
                    <p
                      className={cn(
                        'text-sm font-medium mt-2',
                        venue.openNow ? 'text-mint-600' : 'text-red-600'
                      )}
                    >
                      {venue.openNow ? 'Open now' : 'Closed'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Phone Number */}
            {venue.formattedPhoneNumber && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-coral-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Phone</p>
                  <a
                    href={`tel:${venue.formattedPhoneNumber}`}
                    className="text-sm text-coral-600 hover:text-coral-700 hover:underline"
                  >
                    {venue.formattedPhoneNumber}
                  </a>
                </div>
              </div>
            )}

            {/* Website */}
            {venue.website && (
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-coral-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Website</p>
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-coral-600 hover:text-coral-700 hover:underline inline-flex items-center gap-1"
                  >
                    Visit website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Open in Google Maps Button */}
            <button
              onClick={handleOpenInMaps}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-coral-500 text-white rounded-lg hover:bg-coral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
            >
              <MapPin className="w-5 h-5" />
              <span className="font-medium">Open in Google Maps</span>
            </button>
          </div>
        </>
      )}

      {/* No Venue Selected */}
      {!loading && !venue && (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center space-y-4">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No venue selected</p>
          </div>
        </div>
      )}
    </aside>
  );
}
