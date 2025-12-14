/**
 * Participant-related type definitions
 */

import { Location } from './map';

export interface Participant {
  id: string;
  name: string;
  address: string;
  location: Location;
  color: string; // Tailwind color class (e.g., 'bg-coral-500')
  fuzzyLocation: boolean;
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
export type CreateParticipantDTO = Pick<Participant, 'name' | 'address'> & {
  fuzzyLocation?: boolean;
};

export type UpdateParticipantDTO = Partial<Pick<Participant, 'name' | 'address' | 'fuzzyLocation'>>;
