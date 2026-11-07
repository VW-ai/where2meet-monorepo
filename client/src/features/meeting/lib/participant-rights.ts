import type { Participant } from '@/entities';

export type Viewer =
  | { kind: 'organizer'; participantId: string }
  | { kind: 'participant'; participantId: string }
  | { kind: 'visitor' };

export type RowTag = { kind: 'host' } | { kind: 'addedByYou' } | { kind: 'addedBy'; name: string };

export interface ParticipantRights {
  isSelf: boolean;
  editMode: boolean;
  editDetails: boolean;
  claim: boolean;
  remove: boolean;
  tag: RowTag | null;
}

export function viewerFromAuth(auth: {
  organizerParticipantId: string | null;
  currentParticipantId: string | null;
}): Viewer {
  if (auth.organizerParticipantId) {
    return { kind: 'organizer', participantId: auth.organizerParticipantId };
  }
  if (auth.currentParticipantId) {
    return { kind: 'participant', participantId: auth.currentParticipantId };
  }
  return { kind: 'visitor' };
}

function rowTag(viewer: Viewer, person: RowPerson, hostName: string | null): RowTag | null {
  if (person.isOrganizer) return { kind: 'host' };
  if (!person.claimable) return null;
  // Only an organizer can add someone, so the adder is always the host
  if (viewer.kind === 'organizer') return { kind: 'addedByYou' };
  return hostName ? { kind: 'addedBy', name: hostName } : null;
}

type RowPerson = Pick<Participant, 'id' | 'isOrganizer' | 'claimable'>;

/** What the viewer may do with one person's row, and how to label it. Published plans are read-only. */
export function participantRights(
  viewer: Viewer,
  person: RowPerson,
  { isPublished, hostName }: { isPublished: boolean; hostName: string | null }
): ParticipantRights {
  const isSelf = viewer.kind !== 'visitor' && viewer.participantId === person.id;
  const isHost = viewer.kind === 'organizer';
  const open = !isPublished;
  return {
    isSelf,
    editMode: open && (isSelf || (isHost && person.claimable)),
    editDetails: open && (isSelf || isHost),
    claim: open && viewer.kind === 'visitor' && person.claimable,
    remove: open && (isSelf ? viewer.kind === 'participant' : isHost),
    tag: rowTag(viewer, person, hostName),
  };
}

/** The way onto the list this viewer gets, if any. Someone already on it has none of their own. */
export function listEntry(
  viewer: Viewer,
  { isPublished }: { isPublished: boolean }
): 'add' | 'join' | null {
  if (isPublished) return null;
  if (viewer.kind === 'organizer') return 'add';
  return viewer.kind === 'visitor' ? 'join' : null;
}
