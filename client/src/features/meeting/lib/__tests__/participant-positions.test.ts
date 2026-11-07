import { describe, expect, it } from 'vitest';
import type { Participant } from '@/entities';
import { participantPositionsKey } from '../participant-positions';

const person = (id: string, name: string, lat: number | null, lng: number | null) =>
  ({ id, name, location: lat === null ? null : { lat, lng } }) as unknown as Participant;

describe('participantPositionsKey', () => {
  it('spells out each person and where they are', () => {
    expect(
      participantPositionsKey([person('a', 'Sam', 1, 2), person('b', 'Maya', null, null)])
    ).toBe('a:1,2|b:,');
  });

  it('ignores a rename', () => {
    expect(participantPositionsKey([person('a', 'Sam', 1, 2)])).toBe(
      participantPositionsKey([person('a', 'Samuel', 1, 2)])
    );
  });

  it('changes when someone moves', () => {
    expect(participantPositionsKey([person('a', 'Sam', 1, 2)])).not.toBe(
      participantPositionsKey([person('a', 'Sam', 1, 3)])
    );
  });

  it('changes when someone joins', () => {
    expect(participantPositionsKey([person('a', 'Sam', 1, 2)])).not.toBe(
      participantPositionsKey([person('a', 'Sam', 1, 2), person('b', 'Maya', 3, 4)])
    );
  });
});
