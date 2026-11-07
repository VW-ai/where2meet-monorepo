import { describe, expect, it } from 'vitest';
import type { Participant, Venue } from '@/entities';
import { sidebarVenues, stepVenue, topLikedVenueId, venueLikes } from '../venue-list';

const venue = (id: string, voteCount?: number) => ({ id, voteCount }) as Venue;
const person = (id: string) => ({ id, name: id }) as Participant;

describe('sidebarVenues', () => {
  const searched = [venue('s1'), venue('s2')];
  const venueById = { a: venue('a', 1), b: venue('b', 3) };

  it('shows search results as they came', () => {
    expect(
      sidebarVenues({ scope: 'search', searched, likedIds: ['a'], venueById }).map((v) => v.id)
    ).toEqual(['s1', 's2']);
  });

  it('shows liked venues by vote count, skipping ones not loaded yet', () => {
    expect(
      sidebarVenues({ scope: 'liked', searched, likedIds: ['a', 'missing', 'b'], venueById }).map(
        (v) => v.id
      )
    ).toEqual(['b', 'a']);
  });
});

describe('stepVenue', () => {
  const list = [venue('a'), venue('b'), venue('c')];

  it('walks forward and back, wrapping at the ends', () => {
    expect(stepVenue(list, 'a', 1)?.id).toBe('b');
    expect(stepVenue(list, 'a', -1)?.id).toBe('c');
    expect(stepVenue(list, 'c', 1)?.id).toBe('a');
  });

  it('enters the list from a venue outside it', () => {
    expect(stepVenue(list, 'elsewhere', 1)?.id).toBe('a');
    expect(stepVenue(list, 'elsewhere', -1)?.id).toBe('c');
  });

  it('has nowhere to go from the only venue, or in an empty list', () => {
    expect(stepVenue([venue('a')], 'a', 1)).toBeNull();
    expect(stepVenue([], 'a', 1)).toBeNull();
  });
});

describe('topLikedVenueId', () => {
  it('names the most liked venue', () => {
    expect(topLikedVenueId({ a: { voteCount: 2 }, b: { voteCount: 3 } })).toBe('b');
  });

  it('needs at least two likes', () => {
    expect(topLikedVenueId({ a: { voteCount: 1 } })).toBeNull();
    expect(topLikedVenueId({})).toBeNull();
  });
});

describe('venueLikes', () => {
  const people = [person('sam'), person('maya'), person('jun'), person('theo')];

  it('puts the viewer first among voters and keeps the rest as others', () => {
    const { voters, others } = venueLikes(['maya', 'theo'], people, 'theo');
    expect(voters.map((p) => p.id)).toEqual(['theo', 'maya']);
    expect(others.map((p) => p.id)).toEqual(['sam', 'jun']);
  });

  it('ignores votes from people no longer in the plan', () => {
    expect(venueLikes(['gone'], people, null).voters).toEqual([]);
  });

  it('counts only people who can like: unclaimed rows are neither others nor in the total', () => {
    const mom = { ...person('mom'), claimable: true };
    const { others, total } = venueLikes(['maya'], [...people, mom], null);
    expect(total).toBe(4);
    expect(others.map((p) => p.id)).toEqual(['sam', 'jun', 'theo']);
  });

  it('counts someone once they claim their row', () => {
    const mom = { ...person('mom'), claimable: false };
    expect(venueLikes([], [...people, mom], null).total).toBe(5);
  });
});
