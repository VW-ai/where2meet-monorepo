import type { Participant, Venue } from '@/entities';

export type VenueListScope = 'search' | 'liked';

/** The list the sidebar shows, in its order. */
export function sidebarVenues({
  scope,
  searched,
  likedIds,
  venueById,
}: {
  scope: VenueListScope;
  searched: Venue[];
  likedIds: readonly string[];
  venueById: Record<string, Venue>;
}): Venue[] {
  if (scope === 'search') return searched;
  return likedIds
    .flatMap((id) => venueById[id] ?? [])
    .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
}

/** The venue `delta` steps along the list, wrapping. Null when there is nowhere else to go. */
export function stepVenue(list: readonly Venue[], currentId: string, delta: 1 | -1): Venue | null {
  const at = list.findIndex((venue) => venue.id === currentId);
  if (list.length === 0 || (at >= 0 && list.length === 1)) return null;
  if (at < 0) return delta > 0 ? list[0] : list[list.length - 1];
  return list[(at + delta + list.length) % list.length];
}

/** The most liked venue, once at least two people agree. The first listed wins a tie. */
export function topLikedVenueId(stats: Record<string, { voteCount: number }>): string | null {
  let top: string | null = null;
  let most = 1;
  for (const [id, { voteCount }] of Object.entries(stats)) {
    if (voteCount > most) {
      top = id;
      most = voteCount;
    }
  }
  return top;
}

/**
 * Who liked a venue, viewer first, and who hasn't. Votes from people who left don't count.
 * Nobody can like on behalf of an unclaimed row, so those people aren't waited on either.
 */
export function venueLikes(
  voterIds: readonly string[],
  participants: readonly Participant[],
  myId: string | null
) {
  const eligible = participants.filter((p) => !p.claimable);
  const voted = eligible.filter((p) => voterIds.includes(p.id));
  return {
    voters: [...voted].sort((a, b) => Number(b.id === myId) - Number(a.id === myId)),
    others: eligible.filter((p) => !voterIds.includes(p.id)),
    total: eligible.length,
  };
}
