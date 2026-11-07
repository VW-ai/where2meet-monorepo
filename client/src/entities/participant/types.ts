/**
 * Participant-related type definitions
 */

import { Location, TravelMode } from '@/shared/types/map';

export interface Participant {
  id: string;
  name: string;
  address: string | null;
  location: Location | null;
  color: string; // Tailwind color class (e.g., 'bg-coral-500')
  isOrganizer: boolean;
  travelMode: TravelMode;
  /** Added by the organizer and not yet taken by the person themselves */
  claimable: boolean;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Response from participant API endpoints
 * participantToken is only returned on self-registration (no auth header)
 */
export interface ParticipantResponse extends Participant {
  participantToken?: string;
}

// DTOs
export type CreateParticipantDTO = Pick<Participant, 'name'> & {
  address?: string | null;
  travelMode?: TravelMode;
};

export type UpdateParticipantDTO = Partial<Pick<Participant, 'name' | 'travelMode'>> & {
  address?: string | null;
};
