import type { ParticipantPreview } from '@/features/meeting/api';
import type { RouteInfo } from '@/features/meeting/model/map-store';
import type { Location, TravelMode } from '@/shared/types/map';
import { toRouteInfo } from './person-routes';

/** Stands in for a participant id on the one route that belongs to nobody yet. */
export const DRAFT_PERSON_ID = 'draft';

export interface PickedPlace {
  address: string;
  placeId: string;
}

export type AddStep = 'name' | 'place' | 'mode';

/** Each answer reveals the next question. Clearing the name goes back to asking for it. */
export function addStep(name: string, place: PickedPlace | null): AddStep {
  if (!name.trim()) return 'name';
  return place ? 'mode' : 'place';
}

export type DraftPreview =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; location: Location; hasVenue: boolean; routes: RouteInfo[] };

export function toDraftPreview(response: ParticipantPreview, hasVenue: boolean): DraftPreview {
  return {
    status: 'ready',
    location: response.location,
    hasVenue,
    routes: response.routes.map((route) =>
      toRouteInfo({ ...route, participantId: DRAFT_PERSON_ID })
    ),
  };
}

export type ModeEstimate = { kind: 'label' } | { kind: 'time'; seconds: number } | { kind: 'none' };

/** What a mode button can say. Anything short of an answer about a venue falls back to its label. */
export function modeEstimate(preview: DraftPreview | null, mode: TravelMode): ModeEstimate {
  if (preview?.status !== 'ready' || !preview.hasVenue) return { kind: 'label' };
  const route = preview.routes.find((candidate) => candidate.travelMode === mode);
  return route ? { kind: 'time', seconds: route.durationSeconds } : { kind: 'none' };
}

/** What the map draws for someone being added, who is on no list and in no count. */
export interface DraftPerson {
  name: string;
  color: string;
  location: Location;
  route: RouteInfo | null;
}

export function draftPerson(
  preview: DraftPreview | null,
  mode: TravelMode,
  color: string,
  name: string
): DraftPerson | null {
  if (preview?.status !== 'ready') return null;
  return {
    name,
    color,
    location: preview.location,
    route: preview.routes.find((route) => route.travelMode === mode) ?? null,
  };
}
