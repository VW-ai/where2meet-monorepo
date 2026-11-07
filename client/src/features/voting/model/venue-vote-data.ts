import type { Venue } from '@/entities';
import type { CastVoteRequest } from '@/shared/types/api';

/** A vote persists the venue it's for, so the group's list keeps it after the search changes. */
export function venueVoteData(venue: Venue): CastVoteRequest['venueData'] {
  return {
    name: venue.name,
    address: venue.address || undefined,
    lat: venue.location.lat,
    lng: venue.location.lng,
    category: venue.types?.[0] || undefined,
    rating: venue.rating ?? undefined,
    priceLevel: venue.priceLevel ?? undefined,
    photoUrl: venue.photoUrl ?? undefined,
  };
}
