import { handleSSEMessage } from '@/features/meeting/lib/sse-handlers';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useParticipantStore } from '@/features/meeting/model/participant-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import type { Event } from '@/entities/event/types';
import type { Participant } from '@/entities/participant/types';
import type { Venue } from '@/entities/venue/types';

const EVENT_ID = 'evt_1792167269143_bqAdVLMBseGmhgHK';
const TESTER_ID = '686b6702-ab7e-4130-9ced-4b9a41dcf54f';
const BRICKYARD_ID = 'ChIJme4A6d5bwokR7QwUdTNRp5E';

const TESTER: Participant = {
  id: TESTER_ID,
  name: 'Tester',
  address: null,
  location: null,
  color: 'coral',
  fuzzyLocation: false,
  isOrganizer: true,
};

const EVENT: Event = {
  id: EVENT_ID,
  title: 'Café SSE test, before fix',
  meetingTime: '2026-10-20T00:00:00.000Z',
  meetingTimeZone: null,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
  participants: [TESTER],
  mec: null,
  publishedVenueId: null,
  publishedAt: null,
  settings: { allowParticipantsAfterPublish: true },
};

const BRICKYARD: Venue = {
  id: BRICKYARD_ID,
  name: 'Brickyard Craft Kitchen & Bar',
  address: '23 Park Pl, New York, NY 10007, USA',
  location: { lat: 40.7133249, lng: -74.008664 },
  types: ['bar'],
  rating: 4.7,
  userRatingsTotal: null,
  priceLevel: 2,
  openNow: true,
  photoUrl: null,
};

const RENAME =
  '{"event":{"id":"evt_1792167269143_bqAdVLMBseGmhgHK","title":"Café SSE test, split reads before fix","meetingTime":"2026-10-21T00:00:00.000Z","meetingTimeZone":"America/New_York","publishedAt":null,"publishedVenueId":null}}';
const PUBLISH =
  '{"event":{"id":"evt_1792167269143_bqAdVLMBseGmhgHK","title":"Café SSE test, split reads before fix","meetingTime":"2026-10-21T00:00:00.000Z","meetingTimeZone":"America/New_York","publishedAt":"2026-10-16T18:06:32.751Z","publishedVenueId":"ChIJme4A6d5bwokR7QwUdTNRp5E"},"venue":{"id":"ChIJme4A6d5bwokR7QwUdTNRp5E","name":"Brickyard Craft Kitchen & Bar","address":"23 Park Pl, New York","lat":40.7133249,"lng":-74.008664}}';
const PARTICIPANT_ADDED =
  '{"participant":{"id":"53d4c04a-e630-4c5c-8b1c-b36e142918f8","name":"SSE Probe","address":"Bryant Park Winter Village, 6th Avenue, New York, NY, USA","lat":40.7535021,"lng":-73.983585,"color":"teal","isOrganizer":false}}';
const PARTICIPANT_UPDATED =
  '{"participant":{"id":"53d4c04a-e630-4c5c-8b1c-b36e142918f8","name":"SSE Probe renamed","address":"Bryant Park Winter Village, 6th Avenue, New York, NY, USA","lat":40.7535021,"lng":-73.983585,"color":"teal","isOrganizer":false}}';
const PARTICIPANT_REMOVED = '{"participantId":"53d4c04a-e630-4c5c-8b1c-b36e142918f8"}';
const VOTE_CHANGED =
  '{"eventId":"evt_1792167269143_bqAdVLMBseGmhgHK","seq":1,"venueId":"ChIJme4A6d5bwokR7QwUdTNRp5E","voterId":"686b6702-ab7e-4130-9ced-4b9a41dcf54f","delta":1,"voteCount":1,"totalVotes":1,"updatedAt":"2026-10-16T17:58:31.100Z"}';
const VOTE_STATISTICS =
  '{"eventId":"evt_1792167269143_bqAdVLMBseGmhgHK","seq":2,"venues":[{"venueId":"ChIJme4A6d5bwokR7QwUdTNRp5E","voteCount":1,"voterIds":["686b6702-ab7e-4130-9ced-4b9a41dcf54f"],"voterNames":["686b6702-ab7e-4130-9ced-4b9a41dcf54f"]}],"totalVotes":1,"updatedAt":"2026-10-16T17:58:31.104Z"}';

const VOTE_STATISTICS_EMPTY =
  '{"eventId":"evt_1792167269143_bqAdVLMBseGmhgHK","seq":4,"venues":[],"totalVotes":0,"updatedAt":"2026-10-16T17:58:41.043Z"}';

const FUZZY_ID = '7c1f3a2e-0b9d-4c55-9e61-2f8d4a6b1c30';
const FUZZY_ADDED =
  '{"participant":{"id":"7c1f3a2e-0b9d-4c55-9e61-2f8d4a6b1c30","name":"Quiet Probe","address":null,"lat":40.7541,"lng":-73.9849,"color":"violet","isOrganizer":false,"fuzzyLocation":true}}';
const FUZZY_RENAMED_BY_OLDER_SERVER =
  '{"participant":{"id":"7c1f3a2e-0b9d-4c55-9e61-2f8d4a6b1c30","name":"Quiet Probe renamed","address":null,"lat":40.7541,"lng":-73.9849,"color":"violet","isOrganizer":false}}';
const FUZZY_TURNED_OFF =
  '{"participant":{"id":"7c1f3a2e-0b9d-4c55-9e61-2f8d4a6b1c30","name":"Quiet Probe renamed","address":"Bryant Park, New York, NY","lat":40.7536,"lng":-73.9832,"color":"violet","isOrganizer":false,"fuzzyLocation":false}}';

function receive(event: string, data: string) {
  handleSSEMessage({ event, data, id: '' }, EVENT_ID);
}

function currentEvent() {
  return useMeetingStore.getState().currentEvent;
}

let errors: unknown[][];
let warnings: unknown[][];

beforeEach(() => {
  useMeetingStore.getState().reset();
  useMeetingStore.setState({
    currentEvent: { ...EVENT },
    venueById: { [BRICKYARD_ID]: BRICKYARD },
  });
  useParticipantStore.getState().setParticipants([TESTER]);
  useVotingStore.setState({ voteStatsByVenueId: {}, voteStatistics: null });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  errors = vi.spyOn(console, 'error').mockImplementation(() => {}).mock.calls;
  warnings = vi.spyOn(console, 'warn').mockImplementation(() => {}).mock.calls;
});

afterEach(() => vi.restoreAllMocks());

describe('SSE messages the server sends', () => {
  it('applies a rename with its new time and zone', () => {
    receive('event:updated', RENAME);
    expect([
      currentEvent()?.title,
      currentEvent()?.meetingTime,
      currentEvent()?.meetingTimeZone,
    ]).toEqual([
      'Café SSE test, split reads before fix',
      '2026-10-21T00:00:00.000Z',
      'America/New_York',
    ]);
  });

  it('applies a publish that carries the meeting zone', () => {
    receive('event:published', PUBLISH);
    expect([currentEvent()?.publishedVenueId, currentEvent()?.publishedAt]).toEqual([
      BRICKYARD_ID,
      '2026-10-16T18:06:32.751Z',
    ]);
  });

  it('adds, renames and removes a participant', () => {
    const names = () =>
      useParticipantStore
        .getState()
        .getAllParticipants()
        .map((p) => p.name);
    receive('participant:added', PARTICIPANT_ADDED);
    const added = useParticipantStore
      .getState()
      .getParticipantById('53d4c04a-e630-4c5c-8b1c-b36e142918f8');
    const afterAdd = names();
    receive('participant:updated', PARTICIPANT_UPDATED);
    const afterUpdate = names();
    receive('participant:removed', PARTICIPANT_REMOVED);
    expect([added?.location, afterAdd, afterUpdate, names()]).toEqual([
      { lat: 40.7535021, lng: -73.983585 },
      ['Tester', 'SSE Probe'],
      ['Tester', 'SSE Probe renamed'],
      ['Tester'],
    ]);
  });

  it('keeps whether a participant chose an approximate location', () => {
    const fuzzy = () => {
      const p = useParticipantStore.getState().getParticipantById(FUZZY_ID);
      return [p?.name, p?.address, p?.fuzzyLocation];
    };
    receive('participant:added', FUZZY_ADDED);
    const afterAdd = fuzzy();
    receive('participant:updated', FUZZY_RENAMED_BY_OLDER_SERVER);
    const afterRename = fuzzy();
    receive('participant:updated', FUZZY_TURNED_OFF);
    const afterTurnOff = fuzzy();
    receive('participant:added', PARTICIPANT_ADDED);
    const probe = useParticipantStore
      .getState()
      .getParticipantById('53d4c04a-e630-4c5c-8b1c-b36e142918f8');
    expect([afterAdd, afterRename, afterTurnOff, probe?.fuzzyLocation]).toEqual([
      ['Quiet Probe', null, true],
      ['Quiet Probe renamed', null, true],
      ['Quiet Probe renamed', 'Bryant Park, New York, NY', false],
      false,
    ]);
  });

  it('counts a vote from another tab once, from the statistics snapshot', () => {
    receive('vote:changed', VOTE_CHANGED);
    const afterChanged = useVotingStore.getState().voteStatsByVenueId;
    receive('vote:statistics', VOTE_STATISTICS);
    expect([afterChanged, useVotingStore.getState().voteStatsByVenueId]).toEqual([
      {},
      { [BRICKYARD_ID]: { voteCount: 1, voterIds: [TESTER_ID] } },
    ]);
  });

  it('clears the count when another tab removes the last vote', () => {
    receive('vote:statistics', VOTE_STATISTICS);
    const afterVote = useVotingStore.getState().voteStatsByVenueId;
    receive('vote:statistics', VOTE_STATISTICS_EMPTY);
    expect([afterVote, useVotingStore.getState().voteStatsByVenueId]).toEqual([
      { [BRICKYARD_ID]: { voteCount: 1, voterIds: [TESTER_ID] } },
      {},
    ]);
  });

  it('logs a handler that throws and keeps applying later messages', () => {
    const { setCurrentEvent } = useMeetingStore.getState();
    useMeetingStore.setState({
      setCurrentEvent: () => {
        throw new Error('store broke');
      },
    });
    try {
      receive('event:updated', RENAME);
    } finally {
      useMeetingStore.setState({ setCurrentEvent });
    }
    receive('event:updated', RENAME);
    expect([errors.map(([first]) => first), currentEvent()?.title]).toEqual([
      ['[SSE] Failed to apply event:updated:'],
      'Café SSE test, split reads before fix',
    ]);
  });

  it('ignores heartbeat, close, vote:changed and unknown events without logging', () => {
    receive('heartbeat', '{"timestamp":"2026-10-16T17:57:14.771Z"}');
    receive('close', '{"reason":"server_shutdown"}');
    receive('vote:changed', VOTE_CHANGED);
    receive('participant:typing', '{"participantId":"53d4c04a-e630-4c5c-8b1c-b36e142918f8"}');
    receive('event:updated', RENAME);
    expect([warnings, errors, currentEvent()?.title]).toEqual([
      [],
      [],
      'Café SSE test, split reads before fix',
    ]);
  });
});

describe('SSE payloads that drift from the schema', () => {
  it('drops each one with its event type and what is wrong', () => {
    receive('event:published', PUBLISH.replace('"address":"23 Park Pl, New York"', '"address":42'));
    receive('event:published', PUBLISH.replace('"meetingTimeZone":"America/New_York",', ''));
    receive('event:updated', RENAME.replace('"title":', '"name":'));
    receive('participant:removed', '{"participant":{"id":"53d4c04a-e630-4c5c-8b1c-b36e142918f8"}}');
    expect([errors, currentEvent()?.publishedVenueId, currentEvent()?.title]).toEqual([
      [
        ['[SSE] Dropped event:published: venue.address: expected string, got number'],
        ['[SSE] Dropped event:published: event.meetingTimeZone: expected string, got undefined'],
        ['[SSE] Dropped event:updated: event.title: expected string, got undefined'],
        ['[SSE] Dropped participant:removed: participantId: expected string, got undefined'],
      ],
      null,
      'Café SSE test, before fix',
    ]);
  });

  it('drops data that is not JSON', () => {
    receive('event:updated', '{"event":');
    expect(errors).toEqual([[expect.stringMatching(/^\[SSE\] Dropped event:updated: .*JSON/)]]);
  });
});
