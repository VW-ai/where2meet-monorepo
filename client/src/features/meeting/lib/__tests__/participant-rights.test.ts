import { describe, expect, it } from 'vitest';
import { participantRights, viewerFromAuth, type Viewer } from '../participant-rights';

const SAM = { id: 'sam', isOrganizer: true, claimable: false };
const MAYA = { id: 'maya', isOrganizer: false, claimable: false };
const MOM = { id: 'mom', isOrganizer: false, claimable: true };

const HOST: Viewer = { kind: 'organizer', participantId: 'sam' };
const JOINED: Viewer = { kind: 'participant', participantId: 'maya' };
const VISITOR: Viewer = { kind: 'visitor' };

const rights = (viewer: Viewer, person: typeof SAM, isPublished = false) =>
  participantRights(viewer, person, { isPublished, hostName: 'Sam' });

describe('viewerFromAuth', () => {
  const auth = (organizer: string | null, participant: string | null) =>
    viewerFromAuth({ organizerParticipantId: organizer, currentParticipantId: participant });

  it('tells the three viewers apart, with the organizer taking precedence', () => {
    expect(auth('sam', 'maya')).toEqual(HOST);
    expect(auth(null, 'maya')).toEqual(JOINED);
    expect(auth(null, null)).toEqual(VISITOR);
  });
});

describe('participantRights editMode', () => {
  it.each([
    ['the organizer on their own row', HOST, SAM, true],
    ['the organizer on a row they added', HOST, MOM, true],
    ['the organizer on a row someone joined themselves', HOST, MAYA, false],
    ['a joined person on their own row', JOINED, MAYA, true],
    ['a joined person on someone else', JOINED, SAM, false],
    ['a joined person on an added row', JOINED, MOM, false],
    ['a visitor on an added row', VISITOR, MOM, false],
  ])('%s', (_, viewer, person, expected) => {
    expect(rights(viewer, person).editMode).toBe(expected);
  });
});

describe('participantRights claim', () => {
  it('is for a visitor on an added row only', () => {
    expect(rights(VISITOR, MOM).claim).toBe(true);
    expect(rights(VISITOR, MAYA).claim).toBe(false);
    expect(rights(HOST, MOM).claim).toBe(false);
    expect(rights(JOINED, MOM).claim).toBe(false);
  });
});

describe('participantRights remove', () => {
  it('lets the organizer remove others but not their own row', () => {
    expect(rights(HOST, MOM).remove).toBe(true);
    expect(rights(HOST, MAYA).remove).toBe(true);
    expect(rights(HOST, SAM).remove).toBe(false);
  });

  it('lets a joined person leave and nothing more', () => {
    expect(rights(JOINED, MAYA).remove).toBe(true);
    expect(rights(JOINED, MOM).remove).toBe(false);
    expect(rights(VISITOR, MOM).remove).toBe(false);
  });
});

describe('participantRights editDetails', () => {
  it('follows who could already edit a name and address', () => {
    expect(rights(HOST, MAYA).editDetails).toBe(true);
    expect(rights(JOINED, MAYA).editDetails).toBe(true);
    expect(rights(JOINED, MOM).editDetails).toBe(false);
    expect(rights(VISITOR, MOM).editDetails).toBe(false);
  });
});

describe('participantRights once published', () => {
  it.each([
    ['organizer', HOST, MOM],
    ['joined', JOINED, MAYA],
    ['visitor', VISITOR, MOM],
  ])('leaves the %s with nothing to change', (_, viewer, person) => {
    const { editMode, editDetails, claim, remove } = rights(viewer, person, true);
    expect({ editMode, editDetails, claim, remove }).toEqual({
      editMode: false,
      editDetails: false,
      claim: false,
      remove: false,
    });
  });
});

describe('participantRights tag', () => {
  it('marks the host for everyone', () => {
    expect(rights(VISITOR, SAM).tag).toEqual({ kind: 'host' });
    expect(rights(HOST, SAM).tag).toEqual({ kind: 'host' });
  });

  it('names who added a row, derived from the host', () => {
    expect(rights(HOST, MOM).tag).toEqual({ kind: 'addedByYou' });
    expect(rights(JOINED, MOM).tag).toEqual({ kind: 'addedBy', name: 'Sam' });
    expect(rights(VISITOR, MOM).tag).toEqual({ kind: 'addedBy', name: 'Sam' });
  });

  it('leaves someone who joined themselves untagged', () => {
    expect(rights(HOST, MAYA).tag).toBeNull();
  });
});
