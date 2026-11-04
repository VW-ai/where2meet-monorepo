import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event, Venue } from '@/entities';
import { eventClient } from '@/features/meeting/api';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { APIError } from '@/lib/api/client';
import { publishErrorMessage, publishVenue } from '../publish-venue';

const VENUE: Venue = {
  id: 'venue-1',
  name: 'Kettle Room',
  address: '31-08 Queens Plaza',
  location: { lat: 40.75, lng: -73.94 },
  types: ['cafe'],
  rating: null,
  userRatingsTotal: null,
  priceLevel: null,
  openNow: null,
  photoUrl: null,
};
const PUBLISHED = { id: 'event-1', publishedVenueId: 'venue-1' } as Event;

describe('publishVenue', () => {
  const voteForVenue = vi.fn();
  const publish = vi.spyOn(eventClient, 'publish');

  beforeEach(() => {
    voteForVenue.mockReset().mockResolvedValue(undefined);
    publish.mockReset().mockResolvedValue(PUBLISHED);
    useVotingStore.setState({ voteForVenue, hasVotedFor: () => false });
    useUIStore.setState({ activeView: 'participant' });
    useMeetingStore.setState({ currentEvent: null });
  });

  it('likes the venue, publishes it, and shows the venue list', async () => {
    await publishVenue('event-1', VENUE, 'token');

    expect(voteForVenue).toHaveBeenCalledWith('event-1', 'venue-1', {
      name: 'Kettle Room',
      address: '31-08 Queens Plaza',
      lat: 40.75,
      lng: -73.94,
      category: 'cafe',
      rating: undefined,
      priceLevel: undefined,
      photoUrl: undefined,
    });
    expect(publish).toHaveBeenCalledWith('event-1', 'venue-1', 'token');
    expect(useMeetingStore.getState().currentEvent).toBe(PUBLISHED);
    expect(useUIStore.getState().activeView).toBe('venue');
  });

  it('does not vote twice', async () => {
    useVotingStore.setState({ hasVotedFor: () => true });
    await publishVenue('event-1', VENUE, 'token');
    expect(voteForVenue).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('still publishes when the vote fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    voteForVenue.mockRejectedValue(new Error('vote down'));
    await publishVenue('event-1', VENUE, 'token');
    expect(publish).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });

  it('leaves the event alone when publishing fails', async () => {
    publish.mockRejectedValue(new APIError(409, 'EVENT_ALREADY_PUBLISHED', 'no'));
    await expect(publishVenue('event-1', VENUE, 'token')).rejects.toThrow();
    expect(useMeetingStore.getState().currentEvent).toBeNull();
    expect(useUIStore.getState().activeView).toBe('participant');
  });
});

describe('publishErrorMessage', () => {
  it('explains the cases a person can act on', () => {
    expect(publishErrorMessage(new APIError(409, 'EVENT_ALREADY_PUBLISHED', 'x'), 'en')).toBe(
      'This event has already been published.'
    );
    expect(publishErrorMessage(new APIError(400, 'VALIDATION_ERROR', 'x'), 'zh')).toBe(
      '无法核实所选地点，请换一个地点试试。'
    );
  });

  it('shows other API messages as they are, and a generic line for anything else', () => {
    expect(publishErrorMessage(new APIError(429, 'RATE_LIMIT', 'Rate limited'), 'en')).toBe(
      'Rate limited'
    );
    expect(publishErrorMessage(new Error('boom'), 'en')).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});
