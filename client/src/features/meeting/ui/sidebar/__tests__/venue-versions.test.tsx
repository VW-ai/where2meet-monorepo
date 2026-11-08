import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event, Participant, Venue } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { routeKey } from '@/features/meeting/lib/person-routes';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useUiVersionStore, type UiVersion } from '@/features/meeting/model/ui-version-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import type { TravelMode } from '@/shared/types/map';
import { ParticipantSection } from '../participant-section';
import { PlanTicket, isPublishMoment } from '../plan-ticket';
import { PlacesPanel } from '../../mobile/phone-places';
import { usePhonePlanStore } from '@/features/meeting/model/phone-plan-store';
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
  travelMode: 'driving',
  claimable: false,
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
  useMapStore.setState({ routes, tripRequests: {}, isCalculatingRoutes: false, travelMode: 'car' });
  useRouteCacheStore.setState({ entries: {} });
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
const route = (
  participantId: string,
  durationSeconds: number,
  travelMode: TravelMode = 'driving'
) => ({
  participantId,
  distance: '2 mi',
  duration: 'ignored',
  durationSeconds,
  polyline: '',
  travelMode,
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

  const everyone = [route('sam', 600), route('maya', 300), route('jun', 1500), route('theo', 900)];

  it('names the slowest person with the longest trip, and lists you first', () => {
    arrange({ routes: everyone });
    const text = panelText();
    expect(text).toContain('Everyone there in 25 min');
    expect(text).toContain('Jun has the longest trip, driving');
    expect(text.indexOf('You 5 min')).toBeLessThan(text.indexOf('Jun 25 min'));
  });

  it('counts only the people who have a route when someone has none', () => {
    arrange({ routes: [route('maya', 300), route('jun', 1500)] });
    const text = panelText();
    expect(text).not.toContain('Everyone there');
    expect(text).toContain('2 of 4 there in 25 min');
    expect(text).toContain('Sam No route');
    expect(text).not.toContain('Try again');
  });

  it('tells a failed request apart from a missing route and offers a retry', () => {
    arrange({ routes: [route('maya', 300), route('jun', 1500)] });
    useMapStore.setState({ tripRequests: { sam: 'failed' } });
    const text = panelText();
    expect(text).toContain('Sam Couldn’t load');
    expect(text).toContain('Theo No route');
    expect(text).toContain('Some trips didn’t load. Try again');
    expect(text).toContain('2 of 4 there in 25 min');
  });

  it('makes no claim about the group when every request failed', () => {
    arrange();
    useMapStore.setState({
      tripRequests: { sam: 'failed', maya: 'failed', jun: 'failed', theo: 'failed' },
    });
    const text = panelText();
    expect(text).toContain('Travel times');
    expect(text).not.toContain('there in');
    expect(text).not.toContain('No route');
    expect(text).toContain('Trips didn’t load. Try again');
  });

  it('retries through the store', () => {
    arrange();
    const before = useMapStore.getState().tripRetry;
    useMapStore.getState().retryTrips();
    expect(useMapStore.getState().tripRetry).toBe(before + 1);
  });

  it('holds the headline while someone’s trip is still on its way', () => {
    arrange({ routes: everyone });
    useMapStore.setState({ tripRequests: { theo: 'loading' } });
    const text = panelText();
    expect(text).toContain('Travel times');
    expect(text).toContain('Theo …');
  });

  it('says who has no starting point and keeps them in the count', () => {
    arrange({
      event: { ...EVENT, participants: [SAM, MAYA, JUN, { ...THEO, location: null }] },
      routes: everyone.slice(0, 3),
    });
    const text = panelText();
    expect(text).toContain('Theo No starting point');
    expect(text).toContain('3 of 4 there in 25 min');
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
    expect(textOf(html)).toContain('Slide to lock in');
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

describe('per-person transport', () => {
  const MOM: Participant = { ...person('mom', 'Mom'), claimable: true, address: 'Hunters Point' };
  const withMom = { ...EVENT, participants: [...EVENT.participants, MOM] };
  const people = () => textOf(renderToStaticMarkup(<ParticipantSection />));
  const peopleHtml = () => renderToStaticMarkup(<ParticipantSection />);
  const pickers = (html: string) => html.match(/role="group"/g)?.length ?? 0;

  it('v2 replaces the global choice with your own mode', () => {
    arrange();
    const text = panelText();
    expect(text).not.toContain('Everyone goes by');
    expect(text).toContain('You go by');
  });

  it('a visitor has no mode to set in the panel', () => {
    arrange({ role: 'visitor' });
    expect(panelText()).not.toContain('You go by');
  });

  it('nobody sets a mode in the panel once the plan is published', () => {
    arrange({ event: { ...EVENT, publishedAt: '2026-11-04T00:00:00Z', publishedVenueId: 'k' } });
    expect(panelText()).not.toContain('You go by');
  });

  it('only classic lists the global filter above the venues', () => {
    arrange({ version: 'classic' });
    expect(renderToStaticMarkup(<VenueSection />)).toContain('Travel by Car');
    arrange({ version: 'v2' });
    expect(renderToStaticMarkup(<VenueSection />)).not.toContain('Travel by Car');
  });

  it('words the longest trip by that person’s own mode', () => {
    arrange({
      event: {
        ...EVENT,
        participants: EVENT.participants.map((p) =>
          p.id === 'jun' ? { ...p, travelMode: 'transit' as const } : p
        ),
      },
      routes: [route('maya', 300), route('jun', 1500, 'transit')],
    });
    expect(panelText()).toContain('Jun has the longest trip, by transit');
  });

  it('shows no stale time while a changed mode is on its way', () => {
    arrange({ routes: [route('maya', 300, 'walking')] });
    expect(panelText()).not.toContain('You 5 min');
  });

  it('says a person has no route rather than leaving them out', () => {
    arrange({ routes: [route('maya', 300)] });
    expect(panelText()).toContain('Jun No route');
  });

  it('does not wait on rows nobody has claimed', () => {
    arrange({ event: withMom, voters: ['maya'] });
    expect(panelText()).toContain('1 of 4');
  });

  it('asks a selected editable person how they compare', () => {
    arrange({ routes: [route('maya', 300)] });
    useMapStore.setState({ selectedParticipantId: 'maya' });
    expect(panelText()).toContain('Compare your ways there');
  });

  it('asks the organizer about someone they added, by name', () => {
    arrange({ event: withMom, role: 'organizer', routes: [route('sam', 300)] });
    useMapStore.setState({ selectedParticipantId: 'mom' });
    expect(panelText()).toContain('How is Mom getting there?');
  });

  it('tells others who decides', () => {
    arrange({ event: withMom, routes: [route('sam', 300)] });
    useMapStore.setState({ selectedParticipantId: 'jun' });
    expect(panelText()).toContain('Jun chose this. Only Jun can change it.');
    useMapStore.setState({ selectedParticipantId: 'mom' });
    expect(panelText()).toContain('Sam set this for Mom.');
  });

  it('shows no picker or action on a closed row, only how each person is going', () => {
    arrange({ event: withMom, role: 'organizer' });
    useMapStore.setState({ selectedParticipantId: null });
    const text = people();
    expect(text).toContain('HOST');
    expect(text).toContain('ADDED BY YOU');
    expect(text).toContain('Car · Hunters Point');
    expect(text).not.toContain('Remove');
    expect(text).not.toContain('Edit');
    expect(pickers(peopleHtml())).toBe(0);
  });

  it('opens a row the organizer added with its modes, Edit and a named Remove', () => {
    arrange({ event: withMom, role: 'organizer' });
    useMapStore.setState({ selectedParticipantId: 'mom' });
    const text = people();
    expect(text).toContain('How is Mom getting there?');
    expect(text).toContain('Edit');
    expect(text).toContain('Remove Mom');
    expect(pickers(peopleHtml())).toBe(1);
  });

  it('opens a joined row for the organizer with no picker, keeping Edit and Remove', () => {
    arrange({ event: withMom, role: 'organizer' });
    useMapStore.setState({ selectedParticipantId: 'jun' });
    const text = people();
    expect(text).toContain('Jun chose this. Only Jun can change it.');
    expect(text).toContain('Edit');
    expect(text).toContain('Remove');
    expect(pickers(peopleHtml())).toBe(0);
  });

  it("opens your own row to compare, and someone else's to say who decides", () => {
    arrange({ event: withMom });
    useMapStore.setState({ selectedParticipantId: 'maya' });
    expect(people()).toContain('Compare your ways there');
    expect(people()).toContain('Leave');
    expect(pickers(peopleHtml())).toBe(1);
    useMapStore.setState({ selectedParticipantId: 'jun' });
    expect(people()).toContain('Jun chose this. Only Jun can change it.');
    expect(people()).not.toContain('Edit');
    expect(pickers(peopleHtml())).toBe(0);
  });

  it('asks for your own starting point on your own row, with one Save', () => {
    arrange({
      event: {
        ...withMom,
        participants: withMom.participants.map((p) =>
          p.id === 'maya' ? { ...p, address: null, location: null } : p
        ),
      },
    });
    useMapStore.setState({ selectedParticipantId: null });
    const text = people();
    expect(text).toContain('Where are you coming from?');
    expect(text.match(/Save/g)).toHaveLength(1);
    expect(text).not.toContain('Save my location');
    expect(text).not.toContain('Add starting location');
    useMapStore.setState({ selectedParticipantId: 'maya' });
    expect(people()).not.toContain('Edit');
  });

  it('offers the organizer the same card for someone with no starting point', () => {
    arrange({
      event: {
        ...withMom,
        participants: withMom.participants.map((p) =>
          p.id === 'mom' ? { ...p, address: null, location: null } : p
        ),
      },
      role: 'organizer',
    });
    useMapStore.setState({ selectedParticipantId: null });
    expect(people()).toContain('Add starting location');
    expect(people()).not.toContain('Where is Mom coming from?');
  });

  it('marks only the rows the viewer can change as opening to something to change', () => {
    arrange({ event: withMom, role: 'organizer' });
    useMapStore.setState({ selectedParticipantId: null });
    expect(peopleHtml().match(/lucide-chevron-down/g)).toHaveLength(2);
    arrange({ event: withMom, role: 'visitor' });
    expect(peopleHtml().match(/lucide-chevron-down/g)).toBeNull();
  });

  it('hides the venue card compare from wider screens while the list is showing', () => {
    arrange({ event: withMom, role: 'organizer', routes: [route('sam', 300)] });
    useMapStore.setState({ selectedParticipantId: 'mom' });
    useUIStore.setState({ activeView: 'participant', isSidebarVisible: true });
    expect(renderToStaticMarkup(<VersionedVenuePanel />)).toContain('md:hidden');
    useUIStore.setState({ activeView: 'venue' });
    expect(renderToStaticMarkup(<VersionedVenuePanel />)).not.toContain('md:hidden');
    useUIStore.setState({ activeView: 'participant', isSidebarVisible: false });
    expect(renderToStaticMarkup(<VersionedVenuePanel />)).not.toContain('md:hidden');
    useUIStore.setState({ isSidebarVisible: true });
  });

  it.each([
    ['organizer', 'Add someone'],
    ['visitor', 'Join this plan'],
  ] as const)('gives the %s one way onto the list', (role, label) => {
    arrange({ event: withMom, role });
    expect(people()).toContain(label);
    arrange({
      event: { ...withMom, publishedAt: '2026-11-04T00:00:00Z', publishedVenueId: 'k' },
      role,
    });
    expect(people()).not.toContain(label);
  });

  it('gives someone already on the list no way to add anyone', () => {
    arrange({ event: withMom });
    expect(people()).not.toContain('Add someone');
    expect(people()).not.toContain('Join this plan');
  });

  it('a visitor can claim an added row, and only that row', () => {
    arrange({ event: withMom, role: 'visitor' });
    useMapStore.setState({ selectedParticipantId: null });
    expect(people().match(/That's me/g)).toHaveLength(1);
    expect(pickers(peopleHtml())).toBe(0);
  });

  it('nobody can claim or change anything once published', () => {
    arrange({
      event: { ...withMom, publishedAt: '2026-11-04T00:00:00Z', publishedVenueId: 'k' },
      role: 'visitor',
    });
    expect(people()).not.toContain("That's me");
    arrange({
      event: { ...withMom, publishedAt: '2026-11-04T00:00:00Z', publishedVenueId: 'k' },
      role: 'organizer',
    });
    expect(pickers(peopleHtml())).toBe(0);
    expect(people()).not.toContain('Remove');
  });

  it('classic keeps the pills, with no picker or tag', () => {
    arrange({ version: 'classic', event: withMom, role: 'organizer' });
    expect(people()).not.toContain('ADDED BY YOU');
    expect(pickers(peopleHtml())).toBe(0);
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

  const allFour = ['sam', 'maya', 'jun', 'theo'].map((id, i) => route(id, 600 + i * 300));

  it('only states the trip once routes exist', () => {
    arrange({ event: published });
    expect(ticket()).not.toContain('gets there');
    arrange({ event: published, routes: allFour });
    expect(ticket()).toContain('Everyone gets there within 25 min.');
  });

  it('counts the people who can get there when someone has no route', () => {
    arrange({ event: published, routes: [route('maya', 1500)] });
    const text = ticket();
    expect(text).not.toContain('Everyone gets there');
    expect(text).toContain('1 of 4 people get there within 25 min.');
  });

  it('does not count someone whose request failed as getting there', () => {
    arrange({ event: published, routes: allFour.slice(0, 3) });
    useMapStore.setState({ tripRequests: { theo: 'failed' } });
    expect(ticket()).toContain('3 of 4 people get there');
  });

  it('keeps the line after a reload, when the spot is no longer selected', () => {
    arrange({ event: published });
    useMeetingStore.setState({ selectedVenue: null });
    useRouteCacheStore
      .getState()
      .record(published.participants.map((p, i) => [routeKey(KETTLE.id, p), allFour[i]]));
    expect(ticket()).toContain('Everyone gets there within 25 min.');
  });

  it('stays quiet until every trip to the spot is known', () => {
    arrange({ event: published });
    useMeetingStore.setState({ selectedVenue: null });
    useRouteCacheStore.getState().record([
      [routeKey(KETTLE.id, SAM), allFour[0]],
      [routeKey(KETTLE.id, MAYA), undefined],
    ]);
    expect(ticket()).not.toContain('gets there');
  });

  it('does not credit the spot with routes from another selected venue', () => {
    arrange({ event: published, routes: allFour });
    useMeetingStore.setState({ selectedVenue: { ...KETTLE, id: 'other' } });
    expect(ticket()).not.toContain('gets there');
  });

  it('offers the organizer a way to change the spot', () => {
    arrange({ event: published, role: 'organizer' });
    expect(ticket()).toContain('Change the spot');
  });
});

describe('phone places trip line', () => {
  const places = (detent: 'small' | 'mid' = 'small') => {
    usePhonePlanStore.setState({ detent, searchOpen: false });
    useAuthStore.setState({ participantToken: 'token' });
    return textOf(renderToStaticMarkup(<PlacesPanel lockable={false} />));
  };
  const allFour = ['sam', 'maya', 'jun', 'theo'].map((id, i) => route(id, 600 + i * 300));

  beforeEach(() => usePhonePlanStore.setState({ expandedVenueId: null }));

  it('says everyone only when everyone has a route', () => {
    arrange({ routes: allFour });
    expect(places()).toContain('Everyone within 25 min');
  });

  it('counts the people with a route instead of waiting forever', () => {
    arrange({ routes: allFour.slice(0, 2) });
    const text = places();
    expect(text).not.toContain('Everyone within');
    expect(text).not.toContain('Finding trip times');
    expect(text).toContain('2 of 4 within 15 min');
  });

  it('says a failed request failed and offers a retry', () => {
    arrange({ routes: allFour.slice(0, 3) });
    useMapStore.setState({ tripRequests: { theo: 'failed' } });
    const text = places();
    expect(text).toContain('Some trips didn’t load. Try again');
    expect(text).not.toContain('within');
  });

  it('lists who has no route or a failed trip in the expanded bars', () => {
    arrange({ routes: allFour.slice(0, 2) });
    useMapStore.setState({ tripRequests: { jun: 'failed' } });
    usePhonePlanStore.setState({ expandedVenueId: KETTLE.id });
    const text = places('mid');
    expect(text).toContain('Jun Couldn’t load');
    expect(text).toContain('Theo No route');
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
