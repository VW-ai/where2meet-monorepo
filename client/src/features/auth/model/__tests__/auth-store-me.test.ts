import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth-store';

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  useAuthStore.setState(useAuthStore.getInitialState(), true);
});

afterEach(() => vi.unstubAllGlobals());

describe('meeting credential initialization', () => {
  it('keeps an organizer token without a cached participant ID for /me verification', () => {
    values.set('organizer_token_evt_one', 'pt_organizer');

    useAuthStore.getState().initializeOrganizerMode('evt_one');

    expect(useAuthStore.getState()).toMatchObject({
      organizerToken: 'pt_organizer',
      organizerParticipantId: null,
      isOrganizerMode: false,
    });
  });

  it('keeps a participant token without a cached participant ID for /me verification', () => {
    values.set('participant_token_evt_one', 'pt_participant');

    useAuthStore.getState().initializeParticipantMode('evt_one');

    expect(useAuthStore.getState()).toMatchObject({
      participantToken: 'pt_participant',
      currentParticipantId: null,
      isParticipantMode: false,
    });
  });

  it('does not grant organizer controls from a stale cached ID before /me responds', () => {
    values.set('organizer_token_evt_one', 'pt_organizer');
    values.set('organizer_participant_id_evt_one', 'stale-id');

    useAuthStore.getState().initializeOrganizerMode('evt_one');

    expect(useAuthStore.getState()).toMatchObject({
      organizerToken: 'pt_organizer',
      organizerParticipantId: null,
      isOrganizerMode: false,
    });
  });
});
