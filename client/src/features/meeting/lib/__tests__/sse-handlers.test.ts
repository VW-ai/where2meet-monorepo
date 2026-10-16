import { handleSSEEvent } from '@/features/meeting/lib/sse-handlers';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import type { Event } from '@/entities/event/types';
import type { EventUpdatedPayload, SSEEventData } from '@/shared/types/sse';

const EVENT: Event = {
  id: 'evt_1',
  title: 'Friday dinner',
  meetingTime: '2026-10-17T00:00:00.000Z',
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
  participants: [],
  mec: null,
  publishedVenueId: null,
  publishedAt: null,
  settings: { allowParticipantsAfterPublish: true },
};

// What useEventStream passes on: the server's event:updated payload plus the connection's eventId.
function eventUpdated(event: Partial<EventUpdatedPayload['event']> & { id: string }): SSEEventData {
  return {
    type: 'event:updated',
    data: {
      eventId: 'evt_1',
      event: {
        title: EVENT.title,
        meetingTime: EVENT.meetingTime,
        publishedAt: null,
        publishedVenueId: null,
        ...event,
      },
    },
  };
}

describe('event:updated', () => {
  beforeEach(() => useMeetingStore.getState().setCurrentEvent({ ...EVENT }));

  it('shows the new title and time another person saved', () => {
    handleSSEEvent(
      eventUpdated({
        id: 'evt_1',
        title: 'Friday dinner, moved',
        meetingTime: '2026-10-17T01:30:00.000Z',
      })
    );
    const current = useMeetingStore.getState().currentEvent;
    expect([current?.title, current?.meetingTime, current?.updatedAt]).toEqual([
      'Friday dinner, moved',
      '2026-10-17T01:30:00.000Z',
      '2026-10-16T12:00:00.000Z',
    ]);
  });

  it('shows a cleared time', () => {
    handleSSEEvent(eventUpdated({ id: 'evt_1', meetingTime: null }));
    expect(useMeetingStore.getState().currentEvent?.meetingTime).toBeNull();
  });

  it('shows an unpublish from another tab', () => {
    useMeetingStore.getState().setCurrentEvent({
      ...EVENT,
      publishedVenueId: 'venue_1',
      publishedAt: '2026-10-16T13:00:00.000Z',
    });
    handleSSEEvent(eventUpdated({ id: 'evt_1', publishedAt: null, publishedVenueId: null }));
    const current = useMeetingStore.getState().currentEvent;
    expect([current?.publishedAt, current?.publishedVenueId]).toEqual([null, null]);
  });

  it('ignores an update for another meeting', () => {
    handleSSEEvent(eventUpdated({ id: 'evt_2', title: 'Someone else' }));
    expect(useMeetingStore.getState().currentEvent?.title).toBe('Friday dinner');
  });
});
