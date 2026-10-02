import { beforeEach, describe, expect, it } from 'vitest';
import { usePortalStore } from '../portal-store';

describe('usePortalStore', () => {
  beforeEach(() => usePortalStore.getState().finish());

  it('records creation and the map signal for the same meeting', () => {
    const store = usePortalStore.getState();
    store.start({ left: 0, top: 0, width: 36, height: 36 });
    store.created('evt_1', true);
    usePortalStore.getState().mapReady('evt_1');

    const state = usePortalStore.getState();
    expect(state.status).toBe('running');
    expect(state.eventId).toBe('evt_1');
    expect(state.hasPin).toBe(true);
    expect(state.mapReadyAt).not.toBeNull();
  });

  it('ignores a map signal from another meeting', () => {
    const store = usePortalStore.getState();
    store.start(null);
    store.created('evt_1', false);
    usePortalStore.getState().mapReady('evt_2');
    expect(usePortalStore.getState().mapReadyAt).toBeNull();
  });

  it('ignores signals when nothing is running', () => {
    usePortalStore.getState().created('evt_1', true);
    usePortalStore.getState().mapReady('evt_1');
    usePortalStore.getState().fail();
    expect(usePortalStore.getState()).toMatchObject({
      status: 'idle',
      eventId: null,
      mapReadyAt: null,
    });
  });

  it('fails a running transition and resets on finish', () => {
    usePortalStore.getState().start(null);
    usePortalStore.getState().fail();
    expect(usePortalStore.getState().status).toBe('failed');
    usePortalStore.getState().finish();
    expect(usePortalStore.getState().status).toBe('idle');
  });
});
