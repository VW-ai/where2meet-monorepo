export type ViewerRole = 'visitor' | 'participant' | 'organizer';

export type VenueFooterState =
  | { kind: 'join' }
  | { kind: 'like' }
  | { kind: 'pick' }
  | { kind: 'confirm' }
  | { kind: 'share' }
  | { kind: 'elsewhere'; spotId: string };

const OPEN_FOOTER: Record<ViewerRole, VenueFooterState> = {
  visitor: { kind: 'join' },
  participant: { kind: 'like' },
  organizer: { kind: 'pick' },
};

/** What the venue panel's footer offers. Once a spot is picked, that outranks the viewer's role. */
export function venueFooterState({
  venueId,
  publishedVenueId,
  role,
  confirming,
}: {
  venueId: string;
  publishedVenueId: string | null;
  role: ViewerRole;
  confirming: boolean;
}): VenueFooterState {
  if (publishedVenueId) {
    return publishedVenueId === venueId
      ? { kind: 'share' }
      : { kind: 'elsewhere', spotId: publishedVenueId };
  }
  return role === 'organizer' && confirming ? { kind: 'confirm' } : OPEN_FOOTER[role];
}

/** Older events keep the server's placeholder name for their organizer. */
export function organizerDisplayName(
  participants: readonly { name: string; isOrganizer: boolean }[]
): string | null {
  const name = participants.find((p) => p.isOrganizer)?.name;
  return name && name !== 'Organizer' ? name : null;
}
