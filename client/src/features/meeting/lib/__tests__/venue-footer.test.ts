import { describe, expect, it } from 'vitest';
import { organizerDisplayName, venueFooterState } from '../venue-footer';

const open = { venueId: 'v1', publishedVenueId: null };

describe('venueFooterState', () => {
  it('while the plan is open, follows the viewer role', () => {
    expect(venueFooterState({ ...open, role: 'visitor' })).toEqual({ kind: 'join' });
    expect(venueFooterState({ ...open, role: 'participant' })).toEqual({ kind: 'like' });
    expect(venueFooterState({ ...open, role: 'organizer' })).toEqual({ kind: 'pick' });
  });

  it('on the published venue, everyone can share', () => {
    for (const role of ['visitor', 'participant', 'organizer'] as const) {
      expect(venueFooterState({ ...open, publishedVenueId: 'v1', role })).toEqual({
        kind: 'share',
      });
    }
  });

  it('on any other venue, points at the published one', () => {
    for (const role of ['visitor', 'participant', 'organizer'] as const) {
      expect(venueFooterState({ ...open, publishedVenueId: 'v2', role })).toEqual({
        kind: 'elsewhere',
        spotId: 'v2',
      });
    }
  });
});

describe('organizerDisplayName', () => {
  it('uses the organizer name', () => {
    expect(
      organizerDisplayName([
        { name: 'Maya', isOrganizer: false },
        { name: 'Sam', isOrganizer: true },
      ])
    ).toBe('Sam');
  });

  it('treats the server placeholder as no name', () => {
    expect(organizerDisplayName([{ name: 'Organizer', isOrganizer: true }])).toBeNull();
    expect(organizerDisplayName([{ name: 'Maya', isOrganizer: false }])).toBeNull();
  });
});
