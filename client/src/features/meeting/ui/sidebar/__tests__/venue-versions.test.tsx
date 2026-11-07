import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event, Participant, Venue } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useUiVersionStore, type UiVersion } from '@/features/meeting/model/ui-version-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { PlanTicket, isPublishMoment } from '../plan-ticket';
import { VenueSection } from '../venue-section';
import { VersionedVenuePanel } from '../versioned-venue-panel';

// React's server renderer reads a zustand store's initial state. These tests render through it
// to see components against real stores, so hooks read the current state instead.
vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  const build = (init: Parameters<typeof actual.createStore>[0]) => {
    const api = actual.createStore(init);
    const hook = (selector = (state: unknown) => state) => selector(api.getState());
    return Object.assign(hook, api);
  };
  return {
    ...actual,
    create: (init?: Parameters<typeof actual.createStore>[0]) => (init ? build(init) : build),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/meet/event-1',
  useSearchParams: () => new URLSearchParams(),
}));

const person = (id: string, name: string, isOrganizer = false): Participant => ({
  id,
  name,
  address: null,
  location: { lat: 40.7, lng: -74 },
  color: 'teal',
  isOrganizer,
});

const SAM = person('sam', 'Sam', true);
const MAYA = person('maya', 'Maya');
const JUN = person('jun', 'Jun');
const THEO = person('theo', 'Theo');

const KETTLE: Venue = {
  id: 'kettle',
  name: 'Kettle Room',
  address: '31-08 Queens Plaza',
  location: { lat: 40.75, lng: -73.94 },
  types: ['cafe'],
  rating: 4.6,
  userRatingsTotal: 10,
  priceLevel: 1,
  openNow: true,
  photoUrl: null,
};

const EVENT: Event = {
  id: 'event-1',
  title: 'Friday drinks',
  meetingTime: null,
  meetingTimeZone: null,
  mapProvider: 'google',
  createdAt: '',
  updatedAt: '',
  participants: [SAM, MAYA, JUN, THEO],
  mec: null,
  publishedVenueId: null,
  publishedAt: null,
  settings: { allowParticipantsAfterPublish: false },
};

function arrange({
  version = 'v2',
  event = EVENT,
  role = 'participant',
  voters = ['sam', 'maya'],
  routes = [],
}: {
  version?: UiVersion;
  event?: Event;
  role?: 'visitor' | 'participant' | 'organizer';
  voters?: string[];
  routes?: ReturnType<typeof useMapStore.getState>['routes'];
} = {}) {
  useUiVersionStore.setState({ version });
  useUIStore.setState({ isVenueInfoOpen: true, selectedVenueId: KETTLE.id });
  useMeetingStore.setState({
    currentEvent: event,
    selectedVenue: KETTLE,
    searchedVenues: [KETTLE],
    venueById: { [KETTLE.id]: KETTLE },
  });
  useVotingStore.setState({
    myParticipantId: role === 'visitor' ? null : role === 'organizer' ? 'sam' : 'maya',
    voteStatsByVenueId: { [KETTLE.id]: { voteCount: voters.length, voterIds: voters } },
  });
  useMapStore.setState({ routes, isCalculatingRoutes: false, travelMode: 'car' });
  useAuthStore.setState({
    isOrganizerMode: role === 'organizer',
    isParticipantMode: role === 'participant',
    organizerToken: role === 'organizer' ? 'token' : null,
    organizerParticipantId: role === 'organizer' ? 'sam' : null,
    currentParticipantId: role === 'participant' ? 'maya' : null,
  });
}

function textOf(html: string) {
  return html
    .split(/<[^>]+>/)
    .map((text) => text.trim())
    .filter(Boolean)
    .join(' ')
    .replaceAll('&#x27;', "'");
}

const panelText = () => textOf(renderToStaticMarkup(<VersionedVenuePanel />));
const route = (participantId: string, durationSeconds: number) => ({
  participantId,
  distance: '2 mi',
  duration: 'ignored',
  durationSeconds,
  polyline: '',
});

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('the venue panel by version', () => {
  it('classic renders the old panel', () => {
    arrange({ version: 'classic' });
    const text = panelText();
    expect(text).toContain('Kettle Room');
    expect(text).toContain('Open in Google Maps');
    expect(text).toContain('Address');
    expect(text).not.toContain('No likes yet');
    expect(text).not.toContain('2 of 4');
  });

  it('v2 renders the new panel', () => {
    arrange({ version: 'v2' });
    const text = panelText();
    expect(text).toContain('Kettle Room');
    expect(text).toContain('2 of 4 · You, Sam');
    expect(text).not.toContain('Address');
  });
});

describe('v2 panel states', () => {
  it('says so when nobody has liked the venue', () => {
    arrange({ voters: [] });
    expect(panelText()).toContain('No likes yet');
  });

  it('names the slowest person with the longest trip, and lists you first', () => {
    arrange({ routes: [route('maya', 300), route('jun', 1500)] });
    const text = panelText();
    expect(text).toContain('Everyone there in 25 min');
    expect(text).toContain('Jun has the longest trip, driving');
    expect(text.indexOf('You 5 min')).toBeLessThan(text.indexOf('Jun 25 min'));
    expect(text).toContain('Sam No route');
  });

  it('asks a visitor to join, instead of offering a like', () => {
    arrange({ role: 'visitor' });
    const text = panelText();
    expect(text).toContain('Join to like spots');
    expect(text).toContain('Join the plan to see everyone’s trip.');
    expect(text).not.toContain('Liked');
  });

  it('tells a participant who picks', () => {
    arrange();
    const text = panelText();
    expect(text).toContain('Liked · 2');
    expect(text).toContain('Sam picks the final spot.');
  });

  it('does not repeat the organizer placeholder name', () => {
    arrange({
      event: { ...EVENT, participants: [person('sam', 'Organizer', true), MAYA] },
    });
    expect(panelText()).toContain('The organizer picks the final spot.');
  });

  it('gives the organizer the one radiant action', () => {
    arrange({ role: 'organizer' });
    const html = renderToStaticMarkup(<VersionedVenuePanel />);
    expect(textOf(html)).toContain('Pick this spot');
    expect(html.match(/rad-border/g)).toHaveLength(1);
  });

  it('shares the invite from the published venue', () => {
    arrange({
      event: { ...EVENT, publishedVenueId: KETTLE.id, publishedAt: '2026-11-04T00:00:00Z' },
    });
    const html = renderToStaticMarkup(<VersionedVenuePanel />);
    expect(textOf(html)).toContain('Share invite');
    expect(textOf(html)).toContain('THE SPOT');
    expect(html.match(/rad-border/g)).toHaveLength(1);
  });

  it('points to the published venue from any other', () => {
    arrange({
      event: { ...EVENT, publishedVenueId: 'other', publishedAt: '2026-11-04T00:00:00Z' },
    });
    useMeetingStore.setState({
      venueById: { other: { ...KETTLE, id: 'other', name: 'Low Tide' } },
    });
    const text = panelText();
    expect(text).toContain('The group is going to Low Tide.');
    expect(text).toContain('See the spot');
    expect(text).not.toContain('Share invite');
  });
});

describe('the venue list by version', () => {
  const list = () => textOf(renderToStaticMarkup(<VenueSection />));
  const published = {
    ...EVENT,
    publishedVenueId: KETTLE.id,
    publishedAt: '2026-11-04T00:00:00Z',
  };

  it('classic keeps the old card and its Published label', () => {
    arrange({ version: 'classic', event: published });
    const html = renderToStaticMarkup(<VenueSection />);
    expect(textOf(html)).toContain('Published');
    expect(html).toContain('lucide-crown');
    expect(textOf(html)).not.toContain('THE SPOT');
  });

  it('v2 tags the published venue as the spot, with no crown or Published', () => {
    arrange({ version: 'v2', event: published });
    const html = renderToStaticMarkup(<VenueSection />);
    expect(textOf(html)).toContain('THE SPOT');
    expect(textOf(html)).toContain('2 of 4');
    expect(textOf(html)).not.toContain('Published');
    expect(html).not.toContain('lucide-crown');
  });

  it('v2 tags the most liked venue TOP once two people like it', () => {
    arrange({ version: 'v2', voters: ['sam', 'maya'] });
    expect(list()).toContain('TOP');
  });

  it('v2 does not tag a single like', () => {
    arrange({ version: 'v2', voters: ['sam'] });
    expect(list()).not.toContain('TOP');
  });
});

describe('PlanTicket', () => {
  const published: Event = {
    ...EVENT,
    publishedVenueId: KETTLE.id,
    publishedAt: '2026-11-04T00:00:00Z',
    meetingTime: '2026-11-07T23:30:00Z',
    meetingTimeZone: 'America/New_York',
  };
  const ticket = () => textOf(renderToStaticMarkup(<PlanTicket />));

  it('renders nothing while the plan is open', () => {
    arrange();
    expect(renderToStaticMarkup(<PlanTicket />)).toBe('');
  });

  it('shows the real event, venue, and time in its zone', () => {
    arrange({ event: published });
    const text = ticket();
    expect(text).toContain("IT'S SET · Friday drinks");
    expect(text).toContain('Kettle Room');
    expect(text).toContain('Sat, Nov 7 · 6:30 PM EST');
    expect(text).toContain('31-08 Queens Plaza');
    expect(text).not.toContain('Change the spot');
  });

  it('leaves out the time when there is none', () => {
    arrange({ event: { ...published, meetingTime: null, meetingTimeZone: null } });
    expect(ticket()).not.toContain(' PM');
  });

  it('only states the trip once routes exist', () => {
    arrange({ event: published });
    expect(ticket()).not.toContain('Everyone gets there');
    arrange({ event: published, routes: [route('maya', 1500)] });
    expect(ticket()).toContain('Everyone gets there within 25 min.');
  });

  it('does not credit the spot with routes from another selected venue', () => {
    arrange({ event: published, routes: [route('maya', 1500)] });
    useMeetingStore.setState({ selectedVenue: { ...KETTLE, id: 'other' } });
    expect(ticket()).not.toContain('Everyone gets there');
  });

  it('offers the organizer a way to change the spot', () => {
    arrange({ event: published, role: 'organizer' });
    expect(ticket()).toContain('Change the spot');
  });
});

describe('isPublishMoment', () => {
  const sighting = (eventId: string | undefined, published: boolean) => ({ eventId, published });

  it('stamps when an event on screen becomes published', () => {
    expect(isPublishMoment(sighting('e', false), sighting('e', true))).toBe(true);
  });

  it('does not stamp an event that loads already published', () => {
    expect(isPublishMoment(sighting(undefined, false), sighting('e', true))).toBe(false);
    expect(isPublishMoment(sighting('e', true), sighting('e', true))).toBe(false);
    expect(isPublishMoment(sighting('e', false), sighting('other', true))).toBe(false);
  });
});
