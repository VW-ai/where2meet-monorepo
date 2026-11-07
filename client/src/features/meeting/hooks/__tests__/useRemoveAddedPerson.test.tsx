import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event, Participant } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { participantClient } from '@/features/meeting/api';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useToastStore } from '@/features/meeting/model/toast-store';
import { useRemoveAddedPerson } from '../useParticipantActions';

vi.mock('@/features/meeting/api', () => ({
  eventClient: {},
  participantClient: { remove: vi.fn(), add: vi.fn() },
}));

const MOM: Participant = {
  id: 'mom',
  name: 'Mom',
  address: 'Astoria',
  location: { lat: 40.77, lng: -73.93 },
  color: 'teal',
  isOrganizer: false,
  travelMode: 'transit',
  claimable: true,
};

function actions() {
  let result: ReturnType<typeof useRemoveAddedPerson> | undefined;
  function Probe() {
    result = useRemoveAddedPerson();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result!;
}

const names = () => useMeetingStore.getState().currentEvent?.participants.map((p) => p.id);
const toast = () => useToastStore.getState().toast;

describe('useRemoveAddedPerson', () => {
  beforeEach(() => {
    vi.mocked(participantClient.remove).mockReset().mockResolvedValue({
      success: true,
      message: 'ok',
    });
    vi.mocked(participantClient.add).mockReset();
    useToastStore.getState().dismissToast();
    useAuthStore.setState({ organizerToken: 'token' });
    useMapStore.setState({ selectedParticipantId: 'mom' });
    useMeetingStore.setState({
      currentEvent: { id: 'e', participants: [MOM] } as Event,
    });
  });

  it('removes a row at once and offers to undo it', async () => {
    await actions().removeWithUndo(MOM);
    expect(participantClient.remove).toHaveBeenCalledWith('e', 'mom', 'token');
    expect(names()).toEqual([]);
    expect(useMapStore.getState().selectedParticipantId).toBeNull();
    expect(toast()).toMatchObject({ message: 'Mom removed.', action: { label: 'Undo' } });
  });

  it('undoing a removal asks for the same person again', async () => {
    vi.mocked(participantClient.add).mockResolvedValue({ ...MOM, id: 'mom-again' });
    await actions().removeWithUndo(MOM);

    toast()?.action?.run();
    await vi.waitFor(() => expect(names()).toEqual(['mom-again']));

    expect(participantClient.add).toHaveBeenCalledWith(
      'e',
      { name: 'Mom', address: 'Astoria', travelMode: 'transit' },
      'token'
    );
  });

  it('says so when a removal fails, and keeps the row', async () => {
    vi.mocked(participantClient.remove).mockRejectedValue(new Error('down'));
    await actions().removeWithUndo(MOM);
    expect(names()).toEqual(['mom']);
    expect(toast()?.message).toBe("Couldn't remove Mom. Try again.");
    expect(toast()?.action).toBeUndefined();
  });

  it('undoing an add deletes that row', async () => {
    await actions().undoAdd(MOM);
    expect(participantClient.remove).toHaveBeenCalledWith('e', 'mom', 'token');
    expect(names()).toEqual([]);
  });

  it('does not undo an add once the person has taken their row over', async () => {
    useMeetingStore.setState({
      currentEvent: { id: 'e', participants: [{ ...MOM, claimable: false }] } as Event,
    });
    await actions().undoAdd(MOM);
    expect(participantClient.remove).not.toHaveBeenCalled();
    expect(names()).toEqual(['mom']);
    expect(toast()?.message).toBe('Mom has taken this over, so they stay.');
  });
});
