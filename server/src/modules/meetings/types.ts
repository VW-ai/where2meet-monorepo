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
  | { kind: "participant-updated"; participant: ParticipantSnapshot };

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
  identify(input: Access): Promise<ParticipantSnapshot>;
  update(
    input: Access & { patch: { title?: string; meetingTime?: Date | null } }
  ): Promise<MeetingSnapshot>;
  renameParticipant(
    input: Access & { participantId: string; name: string }
  ): Promise<ParticipantSnapshot>;
  remove(input: Access): Promise<void>;
  votes(eventId: string): Promise<{
    venues: (PlaceSummary & { voteCount: number; voters: string[] })[];
    totalVotes: number;
  }>;
  authorizeStream(input: Access): Promise<void>;
}
