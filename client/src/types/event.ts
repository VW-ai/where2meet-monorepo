/**
 * Event-related type definitions
 */

import { Participant } from './participant';

export interface Event {
  id: string;
  title: string;
  meetingTime: string; // ISO 8601 format
  organizerId: string;
  organizerToken?: string; // Only sent on creation
  createdAt: string;
  updatedAt?: string;
  participants: Participant[];
  publishedVenueId?: string | null;
  publishedAt?: string | null;
  settings: EventSettings;
}

export interface EventSettings {
  organizerOnly: boolean;
}

// DTOs
export type CreateEventDTO = Pick<Event, 'title' | 'meetingTime'>;

export type UpdateEventDTO = Partial<Pick<Event, 'title' | 'meetingTime'>> & {
  settings?: Partial<EventSettings>;
};
