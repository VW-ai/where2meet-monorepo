import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { restoreMeetingIdentity } from '../restore-identity';

const values = new Map<string, string>();

function meResponse(participantId: string, isOrganizer: boolean): Response {
  return new Response(JSON.stringify({
    participantId,
    name: 'Alex',
    isOrganizer,
    color: 'bg-coral-500',
    address: null,
    lat: null,
    lng: null,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  values.clear();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useVotingStore.setState(useVotingStore.getInitialState(), true);
});

afterEach(() => vi.unstubAllGlobals());

describe('restoreMeetingIdentity', () => {
  it('restores an organizer from the old /me response using the original token', async () => {
    values.set('organizer_token_evt_one', 'pt_original');
    values.set('organizer_participant_id_evt_one', 'stale-id');
    useAuthStore.getState().initializeOrganizerMode('evt_one');
    const fetcher = vi.fn().mockResolvedValue(meResponse('organizer-uuid', true));
    vi.stubGlobal('fetch', fetcher);

    await restoreMeetingIdentity('evt_one', 'pt_original');

    expect(fetcher).toHaveBeenCalledWith('http://localhost:3000/api/events/evt_one/me', {
      headers: { Authorization: 'Bearer pt_original' },
    });
    expect(useAuthStore.getState()).toMatchObject({
      isOrganizerMode: true,
      organizerToken: 'pt_original',
      organizerParticipantId: 'organizer-uuid',
      isParticipantMode: false,
      participantToken: null,
    });
    expect(useVotingStore.getState().myParticipantId).toBe('organizer-uuid');
    expect(values.get('organizer_participant_id_evt_one')).toBe('organizer-uuid');
  });

  it('recovers an organizer when only its token was saved', async () => {
    values.set('organizer_token_evt_one', 'pt_original');
    useAuthStore.getState().initializeOrganizerMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('organizer-uuid', true)));

    await restoreMeetingIdentity('evt_one', 'pt_original');

    expect(useAuthStore.getState()).toMatchObject({
      isOrganizerMode: true,
      organizerParticipantId: 'organizer-uuid',
      organizerToken: 'pt_original',
    });
    expect(values.get('organizer_participant_id_evt_one')).toBe('organizer-uuid');
    expect(useVotingStore.getState().myParticipantId).toBe('organizer-uuid');
  });

  it('restores a participant when only the original token is cached', async () => {
    values.set('participant_token_evt_one', 'pt_original');
    useAuthStore.getState().initializeParticipantMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('participant-uuid', false)));

    await restoreMeetingIdentity('evt_one', 'pt_original');

    expect(useAuthStore.getState()).toMatchObject({
      isParticipantMode: true,
      participantToken: 'pt_original',
      currentParticipantId: 'participant-uuid',
      isOrganizerMode: false,
      organizerToken: null,
    });
    expect(useVotingStore.getState().myParticipantId).toBe('participant-uuid');
    expect(values.get('participant_id_evt_one')).toBe('participant-uuid');
  });

  it('replaces a participant ID cached for the wrong person', async () => {
    values.set('participant_token_evt_one', 'pt_original');
    values.set('participant_id_evt_one', 'stale-id');
    useAuthStore.getState().initializeParticipantMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('participant-uuid', false)));

    await restoreMeetingIdentity('evt_one', 'pt_original');

    expect(useAuthStore.getState().currentParticipantId).toBe('participant-uuid');
    expect(values.get('participant_id_evt_one')).toBe('participant-uuid');
    expect(useVotingStore.getState().myParticipantId).toBe('participant-uuid');
  });

  it('reconciles a stale organizer role to the role proved by /me', async () => {
    values.set('organizer_token_evt_one', 'pt_original');
    values.set('organizer_participant_id_evt_one', 'stale-id');
    useAuthStore.getState().initializeOrganizerMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('participant-uuid', false)));

    await restoreMeetingIdentity('evt_one', 'pt_original');

    expect(useAuthStore.getState()).toMatchObject({
      isOrganizerMode: false,
      organizerToken: null,
      organizerParticipantId: null,
      isParticipantMode: true,
      participantToken: 'pt_original',
      currentParticipantId: 'participant-uuid',
    });
    expect(values.has('organizer_token_evt_one')).toBe(false);
    expect(values.get('participant_token_evt_one')).toBe('pt_original');
    expect(useVotingStore.getState().myParticipantId).toBe('participant-uuid');
  });

  it('keeps a distinct saved participant token while confirming the organizer', async () => {
    values.set('organizer_token_evt_one', 'pt_organizer');
    values.set('participant_token_evt_one', 'pt_guest');
    useAuthStore.getState().initializeOrganizerMode('evt_one');
    useAuthStore.getState().initializeParticipantMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('organizer-uuid', true)));

    await restoreMeetingIdentity('evt_one', 'pt_organizer');

    expect(values.get('organizer_token_evt_one')).toBe('pt_organizer');
    expect(values.get('participant_token_evt_one')).toBe('pt_guest');
    expect(useAuthStore.getState().organizerParticipantId).toBe('organizer-uuid');
  });

  it('does not retain privileges after /me rejects a cached token', async () => {
    values.set('organizer_token_evt_one', 'pt_invalid');
    values.set('organizer_participant_id_evt_one', 'stale-id');
    useAuthStore.getState().initializeOrganizerMode('evt_one');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'FORBIDDEN', message: 'Invalid token' },
    }), { status: 403, headers: { 'Content-Type': 'application/json' } })));

    await expect(restoreMeetingIdentity('evt_one', 'pt_invalid')).rejects.toMatchObject({ status: 403 });

    expect(useAuthStore.getState()).toMatchObject({
      isOrganizerMode: false,
      organizerToken: null,
      organizerParticipantId: null,
    });
    expect(values.has('organizer_token_evt_one')).toBe(false);
    expect(useVotingStore.getState().myParticipantId).toBe(null);
  });

  it.each(['organizer', 'participant'] as const)(
    'preserves a newer saved %s credential when an older request is rejected',
    async (role) => {
      const tokenKey = `${role}_token_evt_one`;
      const idKey = role === 'organizer'
        ? 'organizer_participant_id_evt_one'
        : 'participant_id_evt_one';
      values.set(tokenKey, 'pt_original');
      useAuthStore.getState().initializeOrganizerMode('evt_one');
      useAuthStore.getState().initializeParticipantMode('evt_one');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: { code: 'FORBIDDEN', message: 'Invalid token' },
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
      const restored = restoreMeetingIdentity('evt_one', 'pt_original');

      values.set(tokenKey, 'pt_replacement');
      values.set(idKey, 'replacement-uuid');
      await expect(restored).rejects.toMatchObject({ status: 403 });

      expect(values.get(tokenKey)).toBe('pt_replacement');
      expect(values.get(idKey)).toBe('replacement-uuid');
      expect(useAuthStore.getState()).toMatchObject({
        organizerToken: null,
        participantToken: null,
        organizerParticipantId: null,
        currentParticipantId: null,
      });
    }
  );

  it.each([true, false])(
    'ignores delayed success for a replaced token when the returned organizer role is %s',
    async (isOrganizer) => {
      values.set('organizer_token_evt_one', 'pt_original');
      useAuthStore.getState().initializeOrganizerMode('evt_one');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(meResponse('old-uuid', isOrganizer)));
      const restored = restoreMeetingIdentity('evt_one', 'pt_original');

      values.set('organizer_token_evt_one', 'pt_replacement');
      values.set('organizer_participant_id_evt_one', 'replacement-uuid');
      await restored;

      expect(values.get('organizer_token_evt_one')).toBe('pt_replacement');
      expect(values.get('organizer_participant_id_evt_one')).toBe('replacement-uuid');
      expect(values.has('participant_token_evt_one')).toBe(false);
      expect(useAuthStore.getState()).toMatchObject({
        organizerParticipantId: null,
        currentParticipantId: null,
        isOrganizerMode: false,
        isParticipantMode: false,
      });
      expect(useVotingStore.getState().myParticipantId).toBe(null);
    }
  );
});
