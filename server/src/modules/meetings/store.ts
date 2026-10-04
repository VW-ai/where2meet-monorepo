import type { Event, Participant, Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../errors.js";
import { hashToken, newEventId, newParticipantCredential } from "../../runtime/credentials.js";
import { writeTransaction } from "../../runtime/database.js";
import type { Places } from "../places/index.js";
import type {
  Access,
  Meetings,
  MeetingNotice,
  MeetingSnapshot,
  ParticipantSnapshot,
} from "./types.js";

function participantSnapshot(row: Participant): ParticipantSnapshot {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    location:
      row.lat !== null && row.lng !== null
        ? { lat: row.lat.toNumber(), lng: row.lng.toNumber() }
        : null,
    color: row.color,
    fuzzyLocation: row.fuzzyLocation,
    isOrganizer: row.isOrganizer,
  };
}

function meetingSnapshot(row: Event, participants: Participant[]): MeetingSnapshot {
  return { ...row, participants: participants.map(participantSnapshot) };
}

async function eventWithParticipants(
  database: Prisma.TransactionClient,
  eventId: string
): Promise<MeetingSnapshot> {
  const row = await database.event.findUnique({ where: { id: eventId } });
  if (!row) throw new AppError("EVENT_NOT_FOUND", "Event not found");
  const participants = await database.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return meetingSnapshot(row, participants);
}

async function authorize(
  database: Prisma.TransactionClient,
  input: Access,
  organizer = false
): Promise<{ event: Event; participant: Participant }> {
  const event = await database.event.findUnique({ where: { id: input.eventId } });
  if (!event) throw new AppError("EVENT_NOT_FOUND", "Event not found");
  const participant = await database.participant.findFirst({
    where: { eventId: input.eventId, tokenHash: hashToken(input.credential) },
  });
  if (!participant) throw new AppError("FORBIDDEN", "Invalid token");
  if (organizer && !participant.isOrganizer)
    throw new AppError("FORBIDDEN", "Organizer access required");
  return { event, participant };
}

export function createMeetings(dependencies: {
  database: PrismaClient;
  places: Places;
  publish: (eventId: string, notice: MeetingNotice) => Promise<void>;
  publicationFailed: (eventId: string) => void;
}): Meetings {
  const { database, places } = dependencies;
  async function notify(eventId: string, notice: MeetingNotice): Promise<void> {
    try {
      await dependencies.publish(eventId, notice);
    } catch {
      dependencies.publicationFailed(eventId);
    }
  }

  return {
    async create(input) {
      const eventId = newEventId();
      const credential = newParticipantCredential();
      const meeting = await writeTransaction(database, async (tx) => {
        const row = await tx.event.create({
          data: { id: eventId, title: input.title, meetingTime: input.meetingTime },
        });
        const organizer = await tx.participant.create({
          data: {
            id: credential.participantId,
            eventId,
            name: "Organizer",
            color: "coral",
            isOrganizer: true,
            tokenHash: credential.hash,
          },
        });
        return meetingSnapshot(row, [organizer]);
      });
      return {
        meeting,
        participantToken: credential.token,
        organizerParticipantId: credential.participantId,
      };
    },
    async get(eventId) {
      return database.$transaction((tx) => eventWithParticipants(tx, eventId), {
        isolationLevel: "RepeatableRead",
      });
    },
    async identify(input) {
      const { participant } = await authorize(database, input);
      return participantSnapshot(participant);
    },
    async update(input) {
      const meeting = await writeTransaction(database, async (tx) => {
        await authorize(tx, input, true);
        await tx.event.update({ where: { id: input.eventId }, data: input.patch });
        return eventWithParticipants(tx, input.eventId);
      });
      await notify(input.eventId, { kind: "meeting-updated", meeting });
      return meeting;
    },
    async renameParticipant(input) {
      const participant = await writeTransaction(database, async (tx) => {
        const actor = await authorize(tx, input);
        if (!actor.participant.isOrganizer && actor.participant.id !== input.participantId)
          throw new AppError("FORBIDDEN", "Insufficient permissions");
        if (actor.event.publishedAt)
          throw new AppError("EVENT_ALREADY_PUBLISHED", "Event has already been published");
        const target = await tx.participant.findFirst({
          where: { id: input.participantId, eventId: input.eventId },
        });
        if (!target) throw new AppError("PARTICIPANT_NOT_FOUND", "Participant not found");
        return participantSnapshot(
          await tx.participant.update({ where: { id: target.id }, data: { name: input.name } })
        );
      });
      await notify(input.eventId, { kind: "participant-updated", participant });
      return participant;
    },
    async remove(input) {
      await writeTransaction(database, async (tx) => {
        await authorize(tx, input, true);
        await tx.event.delete({ where: { id: input.eventId } });
      });
    },
    async votes(eventId) {
      const votes = await database.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true } });
          if (!event) throw new AppError("EVENT_NOT_FOUND", "Event not found");
          return tx.vote.findMany({
            where: { eventId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });
        },
        { isolationLevel: "RepeatableRead" }
      );
      const grouped = new Map<string, string[]>();
      for (const vote of votes) {
        const voters = grouped.get(vote.venueId) ?? [];
        voters.push(vote.participantId);
        grouped.set(vote.venueId, voters);
      }
      const summaries = await places.summaries([...grouped.keys()]);
      const venues = [...grouped].map(([placeId, voters]) => {
        const place = summaries.get(placeId);
        if (!place) throw new Error("Vote references a missing place");
        return { ...place, voteCount: voters.length, voters };
      });
      venues.sort((a, b) => b.voteCount - a.voteCount);
      return { venues, totalVotes: votes.length };
    },
    async authorizeStream(input) {
      await authorize(database, input);
    },
  };
}
