/**
 * Event-related type definitions
 * Aligned with backend API (Milestone 2)
 */

import { Participant } from '../participant/types';

export interface Event {
  id: string;
  title: string;
  meetingTime: string | null; // ISO 8601 format, null if not set
  participantToken?: string; // Only returned on creation (POST), save it!
  organizerParticipantId?: string; // Organizer's participant ID (only on creation), save it!
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  mec: MEC | null; // Minimum Enclosing Circle (calculated when participants have locations)
  publishedVenueId: string | null;
  publishedAt: string | null;
  settings: EventSettings;
}

export interface MEC {
  center: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
}

export interface EventSettings {
  allowParticipantsAfterPublish: boolean;
}

// DTOs
export interface CreateEventDTO {
  title: string;
  meetingTime?: string; // Optional ISO 8601 datetime
}

export interface UpdateEventDTO {
  title?: string;
  meetingTime?: string;
}
