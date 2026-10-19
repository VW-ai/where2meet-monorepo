import { describe, expect, it } from 'vitest';
import { participantEdits } from '@/features/meeting/lib/participant-edits';

describe('participantEdits from the edit form', () => {
  it('sends only the name when an approximate participant is renamed and the address stays empty', () => {
    expect(participantEdits({ name: 'Bob Lee', address: '' })).toStrictEqual({
      name: 'Bob Lee',
    });
  });

  it('sends the new address when one is picked', () => {
    expect(
      participantEdits({ name: 'Bob Lee', address: 'Bryant Park, New York, NY' })
    ).toStrictEqual({
      name: 'Bob Lee',
      address: 'Bryant Park, New York, NY',
    });
  });
});
