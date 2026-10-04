import { beforeEach, describe, expect, it } from 'vitest';
import type { Event, Venue } from '@/entities';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { handleSSEEvent } from '../sse-handlers';

const meeting: Event = {
  id: 'evt_meeting',
  title: 'Lunch',
  meetingTime: '2026-10-04T19:00:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-03T12:00:00.000Z',
  participants: [],
  mec: null,
  publishedVenueId: 'venue-1',
  publishedAt: '2026-10-03T12:00:00.000Z',
  settings: { allowParticipantsAfterPublish: false },
};

const venue: Venue = {
  id: 'venue-1',
  name: 'Cafe',
  address: '123 Main Street',
  location: { lat: 32.8, lng: -117.2 },
  types: ['cafe'],
  rating: null,
  userRatingsTotal: null,
  priceLevel: null,
  openNow: null,
  photoUrl: null,
};

describe('handleSSEEvent', () => {
  beforeEach(() => {
    useMeetingStore.setState(useMeetingStore.getInitialState(), true);
    useVotingStore.setState(useVotingStore.getInitialState(), true);
    useMeetingStore.setState({
      currentEvent: meeting,
      venueById: { 'venue-1': venue },
    });
    useVotingStore.setState({
      voteStatsByVenueId: {
        'venue-1': { voteCount: 1, voterIds: ['participant-1'] },
      },
    });
  });

  it('clears the final vote when the server sends an empty snapshot', () => {
    handleSSEEvent(
      JSON.parse(`{
        "type": "vote:statistics",
        "data": {
          "eventId": "evt_meeting",
          "seq": 2,
          "venues": [],
          "totalVotes": 0,
          "updatedAt": "2026-10-04T12:00:00.000Z"
        }
      }`)
    );

    expect(useVotingStore.getState().getVoteCountForVenue('venue-1')).toBe(0);
    expect(useVotingStore.getState().getAllVotedVenueIds()).toEqual([]);
    expect(useVotingStore.getState().voteStatistics).toEqual({ venues: [], totalVotes: 0 });
  });

  it('applies nested title, time, and unpublish updates while preserving other event fields', () => {
    handleSSEEvent(
      JSON.parse(`{
        "type": "event:updated",
        "data": {
          "eventId": "evt_meeting",
          "event": {
            "id": "evt_meeting",
            "title": "Dinner",
            "meetingTime": null,
            "publishedAt": null,
            "publishedVenueId": null
          }
        }
      }`)
    );

    expect(useMeetingStore.getState().currentEvent).toEqual({
      ...meeting,
      title: 'Dinner',
      meetingTime: null,
      publishedAt: null,
      publishedVenueId: null,
    });
  });

  it('replaces vote counts and voter IDs with a nonempty server snapshot', () => {
    handleSSEEvent(
      JSON.parse(`{
        "type": "vote:statistics",
        "data": {
          "eventId": "evt_meeting",
          "seq": 3,
          "venues": [{
            "venueId": "venue-1",
            "voteCount": 2,
            "voterIds": ["participant-1", "participant-2"]
          }],
          "totalVotes": 2,
          "updatedAt": "2026-10-04T12:00:00.000Z"
        }
      }`)
    );

    expect(useVotingStore.getState().voteStatsByVenueId).toEqual({
      'venue-1': { voteCount: 2, voterIds: ['participant-1', 'participant-2'] },
    });
    expect(useVotingStore.getState().voteStatistics?.totalVotes).toBe(2);
  });

  it('ignores event updates for another meeting', () => {
    handleSSEEvent(
      JSON.parse(`{
        "type": "event:updated",
        "data": {
          "eventId": "evt_other",
          "event": {
            "id": "evt_other",
            "title": "Another meeting",
            "meetingTime": null,
            "publishedAt": null,
            "publishedVenueId": null
          }
        }
      }`)
    );

    expect(useMeetingStore.getState().currentEvent).toEqual(meeting);
  });

  it('ignores vote snapshots for another meeting', () => {
    handleSSEEvent(
      JSON.parse(`{
        "type": "vote:statistics",
        "data": {
          "eventId": "evt_other",
          "seq": 2,
          "venues": [],
          "totalVotes": 0,
          "updatedAt": "2026-10-04T12:00:00.000Z"
        }
      }`)
    );

    expect(useVotingStore.getState().voteStatsByVenueId).toEqual({
      'venue-1': { voteCount: 1, voterIds: ['participant-1'] },
    });
  });
});
