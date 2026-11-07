'use client';

import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { sidebarVenues } from '@/features/meeting/lib/venue-list';

/** For the venue panel, which can be open while the sidebar's venue section is unmounted. */
export function useSidebarVenues() {
  const { currentEvent, searchedVenues, venueById } = useMeetingStore();
  const { voteStatsByVenueId } = useVotingStore();
  const venueListScope = useUIStore((state) => state.venueListScope);
  return sidebarVenues({
    // The section forces the liked list once a spot is picked
    scope: currentEvent?.publishedAt ? 'liked' : venueListScope,
    searched: searchedVenues,
    likedIds: Object.keys(voteStatsByVenueId),
    venueById,
  });
}
