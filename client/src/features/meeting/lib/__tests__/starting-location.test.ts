import { describe, expect, it } from 'vitest';
import { hidesAddress, startingLocationError } from '../starting-location';

describe('startingLocationError', () => {
  it('lets an empty field keep a saved address only when the server keeps it private', () => {
    expect([
      startingLocationError({ address: '', placeId: '', hasHiddenAddress: true }),
      startingLocationError({ address: ' ', placeId: '', hasHiddenAddress: false }),
    ]).toEqual([null, 'Address is required']);
  });

  it('accepts a saved or picked address and asks for a suggestion otherwise', () => {
    expect([
      startingLocationError({ address: '456 Oak Ave', placeId: '', savedAddress: '456 Oak Ave' }),
      startingLocationError({ address: '350 5th Ave', placeId: 'place_1' }),
      startingLocationError({ address: '456 Oak', placeId: '', hasHiddenAddress: true }),
    ]).toEqual([null, null, 'Pick an address from the suggestions']);
  });

  it('asks an approximate participant with no location for an address like anyone else', () => {
    const bryantPark = { lat: 40.7536, lng: -73.9832 };
    const emptyFieldError = (participant: Parameters<typeof hidesAddress>[0]) =>
      startingLocationError({
        address: '',
        placeId: '',
        hasHiddenAddress: hidesAddress(participant),
      });
    expect([
      emptyFieldError({ fuzzyLocation: true, location: bryantPark }),
      emptyFieldError({ fuzzyLocation: true, location: null }),
      emptyFieldError({ fuzzyLocation: false, location: bryantPark }),
    ]).toEqual([null, 'Address is required', 'Address is required']);
  });
});
