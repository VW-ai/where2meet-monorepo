interface ParticipantFields {
  name: string;
  address: string;
  placeId: string;
  fuzzyLocation: boolean;
}

type ParticipantFormInput = ParticipantFields &
  ({ mode: 'add' } | { mode: 'edit'; savedAddress: string });

export type ParticipantFormData =
  | { mode: 'add'; name: string; address: string; fuzzyLocation: boolean }
  | { mode: 'edit'; name: string; address?: string; fuzzyLocation: boolean };

type ParticipantFormResult =
  | { kind: 'valid'; data: ParticipantFormData }
  | { kind: 'invalid'; errors: { name?: string; address?: string } };

export function prepareParticipantForm(input: ParticipantFormInput): ParticipantFormResult {
  const name = input.name.trim();
  const address = input.address.trim();
  const keepAddress = input.mode === 'edit' && address === input.savedAddress.trim();
  const errors: { name?: string; address?: string } = {};

  if (!name) errors.name = 'Name is required';
  if (!keepAddress) {
    if (!address) errors.address = 'Address is required';
    else if (!input.placeId) errors.address = 'Pick an address from the suggestions';
  }
  if (errors.name || errors.address) return { kind: 'invalid', errors };

  if (input.mode === 'edit') {
    return {
      kind: 'valid',
      data: {
        mode: 'edit',
        name,
        ...(!keepAddress ? { address } : {}),
        fuzzyLocation: input.fuzzyLocation,
      },
    };
  }
  return {
    kind: 'valid',
    data: { mode: 'add', name, address, fuzzyLocation: input.fuzzyLocation },
  };
}
