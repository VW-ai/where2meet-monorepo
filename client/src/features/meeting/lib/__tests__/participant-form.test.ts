import { describe, expect, it } from 'vitest';
import { prepareParticipantForm } from '../participant-form';

describe('participant form submission', () => {
  it('renames a redacted participant without replacing their location', () => {
    expect(
      prepareParticipantForm({
        mode: 'edit',
        name: ' New name ',
        address: '',
        savedAddress: '',
        placeId: '',
        fuzzyLocation: true,
      })
    ).toEqual({
      kind: 'valid',
      data: { mode: 'edit', name: 'New name', fuzzyLocation: true },
    });
  });

  it('keeps a privately loaded address out of an unchanged edit', () => {
    expect(
      prepareParticipantForm({
        mode: 'edit',
        name: 'Guest',
        address: ' 330 Park Blvd ',
        savedAddress: '330 Park Blvd',
        placeId: '',
        fuzzyLocation: false,
      })
    ).toEqual({
      kind: 'valid',
      data: { mode: 'edit', name: 'Guest', fuzzyLocation: false },
    });
  });

  it('requires a suggestion for a replacement and includes the selected address', () => {
    const draft = {
      mode: 'edit' as const,
      name: 'Guest',
      address: 'Balboa Park',
      savedAddress: '',
      placeId: '',
      fuzzyLocation: true,
    };
    expect(prepareParticipantForm(draft)).toEqual({
      kind: 'invalid',
      errors: { address: 'Pick an address from the suggestions' },
    });
    expect(prepareParticipantForm({ ...draft, placeId: 'selected-place' })).toEqual({
      kind: 'valid',
      data: { mode: 'edit', name: 'Guest', address: 'Balboa Park', fuzzyLocation: true },
    });
  });

  it('does not introduce address clearing', () => {
    expect(
      prepareParticipantForm({
        mode: 'edit',
        name: 'Guest',
        address: '',
        savedAddress: '330 Park Blvd',
        placeId: '',
        fuzzyLocation: true,
      })
    ).toEqual({ kind: 'invalid', errors: { address: 'Address is required' } });
  });

  it('requires a name and selected address to join or add', () => {
    expect(
      prepareParticipantForm({
        mode: 'add',
        name: '',
        address: '',
        placeId: '',
        fuzzyLocation: false,
      })
    ).toEqual({
      kind: 'invalid',
      errors: { name: 'Name is required', address: 'Address is required' },
    });
    expect(
      prepareParticipantForm({
        mode: 'add',
        name: ' Guest ',
        address: ' Balboa Park ',
        placeId: 'selected-place',
        fuzzyLocation: false,
      })
    ).toEqual({
      kind: 'valid',
      data: { mode: 'add', name: 'Guest', address: 'Balboa Park', fuzzyLocation: false },
    });
  });
});
