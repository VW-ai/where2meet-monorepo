import type { PlaceSummary } from "../places/index.js";

export interface ParticipantSnapshot {
  id: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number } | null;
  color: string;
  fuzzyLocation: boolean;
  isOrganizer: boolean;
}

export interface MeetingSnapshot {
  id: string;
  title: string;
  meetingTime: Date | null;
  publishedVenueId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantSnapshot[];
}

export type MeetingNotice =
  | { kind: "meeting-updated"; meeting: MeetingSnapshot }
  | { kind: "participant-added" | "participant-updated"; participant: ParticipantSnapshot }
  | { kind: "participant-removed"; participantId: string }
  | { kind: "votes-updated"; votes: VoteSnapshot };

export interface VoteSnapshot {
  venues: { id: string; voters: string[] }[];
  totalVotes: number;
}

export interface NewParticipant {
  name: string;
  address: string;
  fuzzyLocation: boolean;
}

export type ParticipantLocationEdit =
  | { kind: "retain" }
  | { kind: "replace"; address: string; fuzzyLocation?: boolean }
  | { kind: "visibility"; fuzzyLocation: boolean };

export interface Access {
  eventId: string;
  credential: string;
}

export interface Meetings {
  create(input: { title: string; meetingTime: Date | null }): Promise<{
    meeting: MeetingSnapshot;
    participantToken: string;
    organizerParticipantId: string;
  }>;
  get(eventId: string): Promise<MeetingSnapshot>;
  identify(
    input: Access
  ): Promise<{ participant: ParticipantSnapshot; privateAddress: string | null }>;
  update(
    input: Access & { patch: { title?: string; meetingTime?: Date | null } }
  ): Promise<MeetingSnapshot>;
  join(input: { eventId: string; participant: NewParticipant }): Promise<{
    participant: ParticipantSnapshot;
    participantToken: string;
  }>;
  addParticipant(input: Access & { participant: NewParticipant }): Promise<ParticipantSnapshot>;
  updateParticipant(
    input: Access & {
      participantId: string;
      name?: string;
      location: ParticipantLocationEdit;
    }
  ): Promise<ParticipantSnapshot>;
  removeParticipant(input: Access & { participantId: string }): Promise<void>;
  remove(input: Access): Promise<void>;
  votes(eventId: string): Promise<{
    venues: (PlaceSummary & { voteCount: number; voters: string[] })[];
    totalVotes: number;
  }>;
  authorizeStream(input: Access): Promise<void>;
}
