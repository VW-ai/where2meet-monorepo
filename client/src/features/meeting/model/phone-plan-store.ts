'use client';

import { create } from 'zustand';
import type { Event, Participant, Venue } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { participantClient, venueClient } from '@/features/meeting/api';
import {
  putInEvent,
  patchParticipant,
  removeFromEvent,
  signInAsParticipant,
} from '@/features/meeting/hooks/useParticipantActions';
import {
  CATEGORY_QUERY,
  categoryOfKind,
  fitSearchArea,
  planKind,
  type PlaceCategory,
} from '@/features/meeting/lib/phone-plan';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import { venueSearchFilters } from '@/features/meeting/lib/venue-search-filters';
import { analyticsEvents } from '@/lib/analytics/events';
import { reverseGeocodePoint } from '@/shared/lib/map-provider';
import { localeFor } from '@/shared/lib/locale';
import type { Location, TravelMode } from '@/shared/types/map';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { venueVoteData } from '@/features/voting/model/venue-vote-data';
import { useMapStore } from './map-store';
import { useMeetingStore } from './meeting-store';
import { publishErrorMessage, publishVenue, unpublishVenue } from './publish-venue';
import { useToastStore } from './toast-store';

export type Detent = 'small' | 'mid' | 'full';
export type PanelMode = 'locked' | 'roster' | 'draft' | 'aim' | 'places';

export interface StartPoint {
  label: string;
  address: string;
}

export type DraftKind =
  | { type: 'me' }
  | { type: 'other' }
  | { type: 'join' }
  | { type: 'edit'; person: Participant };

export interface PersonDraft {
  kind: DraftKind;
  name: string;
  startText: string;
  chosen: StartPoint | null;
  focus: 'name' | 'start';
  aiming: boolean;
  error: string | null;
  travelMode: TravelMode;
}

export type AimState =
  | { kind: 'moving' }
  | { kind: 'found'; point: StartPoint }
  | { kind: 'nowhere' };

/** What each map provider gives the phone flow, so the flow never touches a provider's SDK. */
export interface PlanMapApi {
  center: () => Location | null;
  zoom: () => number;
  panTo: (point: Location) => void;
  frame: (points: readonly Location[]) => void;
  setSatellite: (on: boolean) => void;
  setSearchArea: (center: Location, radius: number) => void;
  onIdle: (listener: () => void) => () => void;
}

export interface RecentPerson {
  name: string;
  address: string;
}

const RECENTS_KEY = 'w2m-recent-people';
const RECENTS_CAP = 12;

export function readRecents(): RecentPerson[] {
  try {
    return JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentPerson[];
  } catch {
    return [];
  }
}

function rememberPerson(person: RecentPerson) {
  const rest = readRecents().filter((recent) => recent.name !== person.name);
  try {
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify([person, ...rest].slice(0, RECENTS_CAP))
    );
  } catch {
    // Private windows can refuse storage: recents are only a shortcut.
  }
}

interface PhonePlanState {
  active: boolean;
  section: 'people' | 'places';
  draft: PersonDraft | null;
  detent: Detent;
  aim: AimState;
  pinLifted: boolean;
  category: PlaceCategory;
  searchOpen: boolean;
  placeQuery: string;
  expandedVenueId: string | null;
  invited: boolean;
  ticketShown: boolean;
  menuOpen: boolean;
  satellite: boolean;
  userMovedMap: boolean;
  /** Pixels of map the panel covers from the bottom of the screen right now. */
  panelHeight: number;
  searching: boolean;
  searchError: boolean;
  searchedArea: string | null;
  lastQuery: string;
  api: PlanMapApi | null;
}

const initial = {
  section: 'people',
  draft: null,
  detent: 'mid',
  aim: { kind: 'moving' },
  pinLifted: false,
  category: 'all',
  searchOpen: false,
  placeQuery: '',
  expandedVenueId: null,
  invited: false,
  ticketShown: false,
  menuOpen: false,
  userMovedMap: false,
  searching: false,
  searchError: false,
  searchedArea: null,
  lastQuery: CATEGORY_QUERY.all,
} satisfies Partial<PhonePlanState>;

export const usePhonePlanStore = create<PhonePlanState>(() => ({
  ...initial,
  active: false,
  satellite: false,
  panelHeight: 0,
  api: null,
}));

const flow = usePhonePlanStore;

export function panelMode(
  state: Pick<PhonePlanState, 'draft' | 'section'>,
  event: Event | null
): PanelMode {
  if (event?.publishedAt) return 'locked';
  if (state.draft) return state.draft.aiming ? 'aim' : 'draft';
  return state.section === 'people' ? 'roster' : 'places';
}

export function currentPanelMode(): PanelMode {
  return panelMode(flow.getState(), useMeetingStore.getState().currentEvent);
}

export function usePanelMode(): PanelMode {
  const section = flow((state) => state.section);
  const draft = flow((state) => state.draft);
  const event = useMeetingStore((state) => state.currentEvent);
  return panelMode({ section, draft }, event);
}

export interface PlanMapLayers {
  venues: 'all' | 'selected' | 'none';
  circle: boolean;
  routes: boolean;
}

export function layersFor(mode: PanelMode): PlanMapLayers {
  return {
    venues: mode === 'places' ? 'all' : mode === 'locked' ? 'selected' : 'none',
    circle: mode === 'places',
    routes: mode === 'places' || mode === 'locked',
  };
}

/** Null outside the phone flow, where the map shows everything it always has. */
export function usePlanMapLayers(): PlanMapLayers | null {
  const active = flow((state) => state.active);
  const mode = usePanelMode();
  return active ? layersFor(mode) : null;
}

function token(): string | null {
  const auth = useAuthStore.getState();
  return auth.organizerToken || auth.participantToken || null;
}

function myId(): string | null {
  const auth = useAuthStore.getState();
  return auth.organizerParticipantId || auth.currentParticipantId || null;
}

function me(): Participant | null {
  const event = useMeetingStore.getState().currentEvent;
  return event?.participants.find((person) => person.id === myId()) ?? null;
}

function isOrganizer(): boolean {
  return !!useAuthStore.getState().organizerParticipantId;
}

function newDraft(kind: DraftKind, focus: PersonDraft['focus'] = 'start'): PersonDraft {
  return {
    kind,
    name: '',
    startText: '',
    chosen: null,
    focus,
    aiming: false,
    error: null,
    travelMode: kind.type === 'edit' ? kind.person.travelMode : 'driving',
  };
}

export const draftAsksName = (draft: PersonDraft) =>
  draft.kind.type === 'other' || draft.kind.type === 'join';

function draftReady(draft: PersonDraft): boolean {
  return !!draft.chosen && (!draftAsksName(draft) || draft.name.trim() !== '');
}

function areaKey(): string {
  const { searchCircle, searchRadius } = useMapStore.getState();
  if (!searchCircle) return '';
  return `${searchCircle.center.lat.toFixed(5)},${searchCircle.center.lng.toFixed(5)},${Math.round(searchRadius)}`;
}

export function useSearchAreaMoved(): boolean {
  const searchedArea = flow((state) => state.searchedArea);
  useMapStore((state) => state.searchCircle);
  useMapStore((state) => state.searchRadius);
  return searchedArea !== null && searchedArea !== areaKey();
}

export const phonePlan = {
  meetingChanged() {
    const event = useMeetingStore.getState().currentEvent;
    if (!event) return;
    const needsMyStart = isOrganizer() && !event.publishedAt && me()?.location == null;
    flow.setState({
      ...initial,
      draft: needsMyStart ? newDraft({ type: 'me' }) : null,
      detent: event.publishedAt ? 'small' : 'mid',
      category: categoryOfKind(planKind(event.title)),
    });
  },

  setDetent: (detent: Detent) => flow.setState({ detent }),

  showPeople() {
    const { detent } = flow.getState();
    const locked = !!useMeetingStore.getState().currentEvent?.publishedAt;
    flow.setState({
      section: 'people',
      detent: locked ? 'small' : detent === 'small' ? 'mid' : detent,
    });
  },

  addSomeone() {
    flow.setState({
      draft: newDraft({ type: token() ? 'other' : 'join' }, 'name'),
      detent: 'full',
    });
  },

  editStart(person: Participant) {
    flow.setState({ draft: newDraft({ type: 'edit', person }), detent: 'mid' });
  },

  updateDraft(patch: Partial<PersonDraft>) {
    const { draft } = flow.getState();
    if (draft) flow.setState({ draft: { ...draft, ...patch } });
  },

  cancelDraft() {
    const { section } = flow.getState();
    flow.setState({ draft: null, detent: section === 'places' ? 'small' : 'mid' });
  },

  /** A start was picked: it commits when the name is there too, otherwise the name is asked for. */
  choose(point: StartPoint) {
    const { draft } = flow.getState();
    if (!draft) return;
    const next: PersonDraft = {
      ...draft,
      chosen: point,
      startText: point.label,
      aiming: false,
      error: null,
    };
    if (draftReady(next)) {
      flow.setState({ draft: next });
      void phonePlan.commit();
    } else {
      flow.setState({ draft: { ...next, focus: 'name' }, detent: 'full' });
    }
  },

  async commit() {
    const { draft } = flow.getState();
    if (!draft || !draftReady(draft) || !draft.chosen) return;
    const eventId = useMeetingStore.getState().currentEvent?.id;
    if (!eventId) return;
    const address = draft.chosen.address;
    flow.setState({ draft: null, section: 'people', detent: 'mid' });
    try {
      switch (draft.kind.type) {
        case 'me':
        case 'edit': {
          const person = draft.kind.type === 'edit' ? draft.kind.person : me();
          const auth = token();
          if (!person || !auth) return;
          patchParticipant(
            person.id,
            await participantClient.update(
              eventId,
              person.id,
              { address, travelMode: draft.travelMode },
              auth
            )
          );
          break;
        }
        case 'other': {
          const auth = useAuthStore.getState().organizerToken;
          if (!auth) return;
          const name = draft.name.trim().slice(0, 50);
          putInEvent(
            await participantClient.add(
              eventId,
              { name, address, travelMode: draft.travelMode },
              auth
            )
          );
          rememberPerson({ name, address });
          break;
        }
        case 'join': {
          const response = await participantClient.join(eventId, {
            name: draft.name.trim().slice(0, 50),
            address,
            travelMode: draft.travelMode,
          });
          analyticsEvents.joinEvent(eventId, response.id);
          putInEvent(signInAsParticipant(eventId, response));
          break;
        }
      }
      analyticsEvents.addLocation(eventId, address);
    } catch (error) {
      console.error('Error saving a person:', error);
      const locale = localeFor(useMeetingStore.getState().currentEvent?.mapProvider);
      flow.setState({
        draft: {
          ...draft,
          error: participantErrorMessage(
            error,
            locale === 'zh'
              ? '没能保存，请检查地址后重试。'
              : "Couldn't save that. Check the address and try again.",
            locale
          ),
        },
      });
    }
  },

  async quickAdd(recent: RecentPerson) {
    flow.setState({
      draft: {
        ...newDraft({ type: 'other' }),
        name: recent.name,
        chosen: { label: recent.address, address: recent.address },
      },
    });
    await phonePlan.commit();
  },

  invite: () => flow.setState({ invited: true }),

  startAim() {
    const { draft } = flow.getState();
    if (draft) {
      flow.setState({
        draft: { ...draft, aiming: true },
        aim: { kind: 'moving' },
        detent: 'small',
      });
    }
  },

  cancelAim() {
    const { draft } = flow.getState();
    if (draft)
      flow.setState({ draft: { ...draft, aiming: false }, pinLifted: false, detent: 'mid' });
  },

  confirmAim() {
    const { aim } = flow.getState();
    if (aim.kind !== 'found') return;
    flow.setState({ pinLifted: false });
    phonePlan.choose(aim.point);
  },

  aimMoved: () => flow.setState({ pinLifted: true, aim: { kind: 'moving' } }),

  async aimIdle(point: Location) {
    flow.setState({ pinLifted: false });
    const found = await startPointAt(point);
    if (flow.getState().draft?.aiming && !flow.getState().pinLifted) {
      flow.setState({ aim: found ? { kind: 'found', point: found } : { kind: 'nowhere' } });
    }
  },

  async longPress(point: Location, noAddress: string) {
    const { draft } = flow.getState();
    const event = useMeetingStore.getState().currentEvent;
    if (!event || event.publishedAt || draft?.aiming) return;
    const person = me();
    const kind: DraftKind | null = draft
      ? draft.kind
      : !token()
        ? { type: 'join' }
        : isOrganizer()
          ? { type: 'other' }
          : person && { type: 'edit', person };
    if (!kind) return;
    const found = await startPointAt(point);
    if (!found) {
      useToastStore.getState().showToast({ message: noAddress });
      return;
    }
    if (!flow.getState().draft) flow.setState({ draft: newDraft(kind, 'name') });
    phonePlan.choose(found);
  },

  seePlaces() {
    const { searchedArea, placeQuery, category, api } = flow.getState();
    const event = useMeetingStore.getState().currentEvent;
    flow.setState({ section: 'places', detent: 'small' });
    if (searchedArea !== null) return;
    const people = (event?.participants ?? []).filter(hasStartingPoint).map((p) => p.location!);
    const area = fitSearchArea(people);
    if (area) {
      api?.setSearchArea(area.center, area.radius);
      useMapStore.getState().setSearchCircle(area);
      useMapStore.getState().setSearchRadius(area.radius);
    }
    void phonePlan.search(placeQuery || CATEGORY_QUERY[category]);
  },

  chooseCategory(category: PlaceCategory) {
    flow.setState({ category, placeQuery: '' });
    void phonePlan.search(CATEGORY_QUERY[category]);
  },

  searchThisArea() {
    const { placeQuery, category } = flow.getState();
    void phonePlan.search(placeQuery || CATEGORY_QUERY[category]);
  },

  async search(rawQuery: string) {
    const query = rawQuery.trim();
    const event = useMeetingStore.getState().currentEvent;
    const { searchCircle, searchRadius } = useMapStore.getState();
    if (!query || !event || !searchCircle) return;
    flow.setState({ searching: true, searchError: false, lastQuery: query });
    try {
      const { venues } = await venueClient.search(
        {
          center: searchCircle.center,
          searchRadius,
          ...venueSearchFilters(event.mapProvider ?? 'google', query),
          eventId: event.id,
          mapProvider: event.mapProvider,
        },
        token() ?? undefined
      );
      if (flow.getState().lastQuery !== query) return;
      const meeting = useMeetingStore.getState();
      meeting.setSearchedVenues(venues);
      flow.setState({ searchedArea: areaKey(), searching: false });
      const selected = meeting.selectedVenue;
      if (venues[0] && !venues.some((venue) => venue.id === selected?.id)) {
        meeting.setSelectedVenue(venues[0]);
      }
    } catch (error) {
      console.error('Failed to search venues:', error);
      flow.setState({ searching: false, searchError: true, searchedArea: areaKey() });
    }
  },

  tapVenuePin(venue: Venue) {
    useMeetingStore.getState().setSelectedVenue(venue);
    const { section } = flow.getState();
    if (section === 'places' && !useMeetingStore.getState().currentEvent?.publishedAt) {
      flow.setState({ detent: 'small', expandedVenueId: null });
    }
  },

  async toggleLike(venue: Venue, needStart: string) {
    const event = useMeetingStore.getState().currentEvent;
    if (!event) return;
    if (!myId()) {
      useToastStore.getState().showToast({ message: needStart });
      return;
    }
    const voting = useVotingStore.getState();
    try {
      if (voting.hasVotedFor(venue.id)) await voting.unvoteForVenue(event.id, venue.id);
      else await voting.voteForVenue(event.id, venue.id, venueVoteData(venue));
    } catch (error) {
      console.error('Failed to toggle a like:', error);
    }
  },

  async lockIn(venue: Venue): Promise<boolean> {
    const event = useMeetingStore.getState().currentEvent;
    const auth = useAuthStore.getState().organizerToken;
    if (!event || !auth) return false;
    try {
      await publishVenue(event.id, venue, auth);
      flow.setState({ detent: 'small', ticketShown: true });
      return true;
    } catch (error) {
      console.error('Failed to lock in:', error);
      useToastStore.getState().showToast({
        message: publishErrorMessage(error, localeFor(event.mapProvider)),
      });
      return false;
    }
  },

  async reopen(toast: (name: string) => string) {
    const meeting = useMeetingStore.getState();
    const auth = useAuthStore.getState().organizerToken;
    if (!meeting.currentEvent || !auth) return;
    const name = meeting.selectedVenue?.name ?? '';
    await unpublishVenue(meeting.currentEvent.id, auth);
    flow.setState({ section: 'places', detent: 'small' });
    useToastStore.getState().showToast({ message: toast(name) });
  },

  async removeWithUndo(
    person: Participant,
    messages: { removed: (name: string) => string; yours: string; undo: string; failed: string }
  ) {
    const event = useMeetingStore.getState().currentEvent;
    const auth = token();
    if (!event || !auth) return;
    const { showToast } = useToastStore.getState();
    const mine = person.id === myId();
    try {
      await participantClient.remove(event.id, person.id, auth);
      removeFromEvent(person.id);
      if (mine) useAuthStore.getState().clearParticipantInfo(event.id);
      const message = mine ? messages.yours : messages.removed(person.name);
      if (mine || !person.address) {
        showToast({ message });
        return;
      }
      showToast({
        message,
        action: {
          label: messages.undo,
          run: () => {
            void participantClient
              .add(
                event.id,
                { name: person.name, address: person.address, travelMode: person.travelMode },
                auth
              )
              .then(putInEvent)
              .catch(() => showToast({ message: messages.failed }));
          },
        },
      });
    } catch (error) {
      console.error('Failed to remove a person:', error);
      showToast({ message: messages.failed });
    }
  },

  recenter() {
    const { api } = flow.getState();
    flow.setState({ userMovedMap: false });
    const event = useMeetingStore.getState().currentEvent;
    api?.frame((event?.participants ?? []).filter(hasStartingPoint).map((p) => p.location!));
  },

  setSatellite(on: boolean) {
    flow.setState({ satellite: on });
    flow.getState().api?.setSatellite(on);
  },
};

async function startPointAt(point: Location): Promise<StartPoint | null> {
  const provider = useMeetingStore.getState().currentEvent?.mapProvider ?? 'google';
  try {
    const { address } = await reverseGeocodePoint(provider, point);
    return address ? { label: address.split(',')[0], address } : null;
  } catch {
    return null;
  }
}

export { startPointAt };
