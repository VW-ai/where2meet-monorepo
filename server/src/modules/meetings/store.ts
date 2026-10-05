import {
  Prisma,
  type Event,
  type Participant,
  type UserEvent,
  type PrismaClient,
} from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../../errors.js";
import { hashToken, newEventId, newParticipantCredential } from "../../runtime/credentials.js";
import { writeTransaction } from "../../runtime/database.js";
import type { Places } from "../places/index.js";
import type { Routing } from "../routing/index.js";
import { approximatePoint, participantColor } from "./locations.js";
import type {
  Access,
  Meetings,
  MeetingNotice,
  MeetingSnapshot,
  ParticipantSnapshot,
  NewParticipant,
  VoteSnapshot,
  AccountClaim,
  ParticipantRoute,
} from "./types.js";

function accountClaim(row: UserEvent): AccountClaim {
  if (row.role !== "organizer" && row.role !== "participant")
    throw new Error("Invalid stored account claim role");
  return {
    id: row.id,
    eventId: row.eventId,
    participantId: row.participantId,
    role: row.role,
    createdAt: row.createdAt,
  };
}

function participantSnapshot(row: Participant): ParticipantSnapshot {
  return {
    id: row.id,
    name: row.name,
    address: row.fuzzyLocation ? null : row.address,
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

function requireOpen(event: Event): void {
  if (event.publishedAt)
    throw new AppError("EVENT_ALREADY_PUBLISHED", "Event has already been published");
}

async function participantForChange(
  database: Prisma.TransactionClient,
  input: Access & { participantId: string }
): Promise<Participant> {
  const actor = await authorize(database, input);
  if (!actor.participant.isOrganizer && actor.participant.id !== input.participantId)
    throw new AppError("FORBIDDEN", "Insufficient permissions");
  requireOpen(actor.event);
  const target = await database.participant.findFirst({
    where: { id: input.participantId, eventId: input.eventId },
  });
  if (!target) throw new AppError("PARTICIPANT_NOT_FOUND", "Participant not found");
  return target;
}

function sameLocation(a: Participant, b: Participant): boolean {
  return (
    a.address === b.address &&
    a.formattedAddress === b.formattedAddress &&
    a.fuzzyLocation === b.fuzzyLocation &&
    a.lat?.toString() === b.lat?.toString() &&
    a.lng?.toString() === b.lng?.toString()
  );
}

export function createMeetings(dependencies: {
  database: PrismaClient;
  places: Places;
  routing: Routing;
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

  async function locationValues(address: string, fuzzyLocation: boolean) {
    const result = await places.geocode(address);
    if (result.kind === "not-found") throw new AppError("ADDRESS_NOT_FOUND", "Address not found");
    if (result.kind === "unavailable")
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Address lookup is temporarily unavailable");
    const point = fuzzyLocation ? approximatePoint(result.point) : result.point;
    return { address, formattedAddress: result.formattedAddress, fuzzyLocation, ...point };
  }

  async function insertParticipant(input: {
    eventId: string;
    participant: NewParticipant;
    credential?: string;
    id: string;
    tokenHash: string | null;
  }): Promise<ParticipantSnapshot> {
    async function permitted(tx: Prisma.TransactionClient) {
      const event =
        input.credential === undefined
          ? await tx.event.findUnique({ where: { id: input.eventId } })
          : (await authorize(tx, { eventId: input.eventId, credential: input.credential }, true))
              .event;
      if (!event) throw new AppError("EVENT_NOT_FOUND", "Event not found");
      requireOpen(event);
    }
    await permitted(database);
    const location = await locationValues(
      input.participant.address,
      input.participant.fuzzyLocation
    );
    const participant = await writeTransaction(database, async (tx) => {
      await permitted(tx);
      const participants = await tx.participant.findMany({
        where: { eventId: input.eventId },
        select: { color: true },
      });
      const row = await tx.participant.create({
        data: {
          id: input.id,
          eventId: input.eventId,
          name: input.participant.name,
          color: participantColor(participants.map((entry) => entry.color)),
          tokenHash: input.tokenHash,
          ...location,
        },
      });
      return participantSnapshot(row);
    });
    await notify(input.eventId, { kind: "participant-added", participant });
    return participant;
  }

  async function voteSnapshot(eventId: string): Promise<VoteSnapshot> {
    return database.$transaction(
      async (tx) => {
        const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) throw new AppError("EVENT_NOT_FOUND", "Event not found");
        const votes = await tx.vote.findMany({
          where: { eventId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        const grouped = new Map<string, string[]>();
        for (const vote of votes) {
          const voters = grouped.get(vote.venueId) ?? [];
          voters.push(vote.participantId);
          grouped.set(vote.venueId, voters);
        }
        return {
          venues: [...grouped].map(([id, voters]) => ({ id, voters })),
          totalVotes: votes.length,
        };
      },
      { isolationLevel: "RepeatableRead" }
    );
  }

  return {
    async claim(input) {
      try {
        return await writeTransaction(database, async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: input.eventId },
            select: { id: true },
          });
          if (!event) throw new AppError("EVENT_NOT_FOUND", "Event not found");
          const participant = await tx.participant.findFirst({
            where: { eventId: input.eventId, tokenHash: hashToken(input.credential) },
            select: { id: true, isOrganizer: true },
          });
          if (!participant) throw new AppError("FORBIDDEN", "Invalid participant token");
          const membership = {
            participantId: participant.id,
            role: participant.isOrganizer ? "organizer" : "participant",
          };
          const row = await tx.userEvent.upsert({
            where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
            create: {
              id: `ue_${randomBytes(16).toString("hex")}`,
              userId: input.userId,
              eventId: input.eventId,
              ...membership,
            },
            update: membership,
          });
          return accountClaim(row);
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002")
            throw new AppError("CONFLICT", "Participant is already claimed");
          if (error.code === "P2003" || error.code === "P2034")
            throw new AppError("CONFLICT", "Account membership changed; try again");
        }
        throw error;
      }
    },
    async listForAccount(userId) {
      const rows = await database.$transaction(
        (tx) =>
          tx.userEvent.findMany({
            where: { userId },
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  meetingTime: true,
                  publishedAt: true,
                  createdAt: true,
                  participants: {
                    select: { id: true, name: true, color: true, isOrganizer: true },
                    orderBy: { createdAt: "asc" },
                  },
                  _count: { select: { participants: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
        { isolationLevel: "RepeatableRead" }
      );
      return rows.map((row) => {
        const claim = accountClaim(row);
        return {
          id: claim.id,
          role: claim.role,
          participantId: claim.participantId,
          createdAt: claim.createdAt,
          event: {
            id: row.event.id,
            title: row.event.title,
            meetingTime: row.event.meetingTime,
            publishedAt: row.event.publishedAt,
            createdAt: row.event.createdAt,
            participantCount: row.event._count.participants,
            participants: row.event.participants,
          },
        };
      });
    },
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
      return { participant: participantSnapshot(participant), privateAddress: participant.address };
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
    async join(input) {
      const credential = newParticipantCredential();
      const participant = await insertParticipant({
        ...input,
        id: credential.participantId,
        tokenHash: credential.hash,
      });
      return { participant, participantToken: credential.token };
    },
    async addParticipant(input) {
      return insertParticipant({ ...input, id: randomUUID(), tokenHash: null });
    },
    async updateParticipant(input) {
      const before = await participantForChange(database, input);
      const edit = input.location;
      const address = edit.kind === "replace" ? edit.address : before.address;
      const fuzzyLocation =
        edit.kind === "retain"
          ? before.fuzzyLocation
          : (edit.fuzzyLocation ?? before.fuzzyLocation);
      const changed =
        address !== before.address ||
        fuzzyLocation !== before.fuzzyLocation ||
        (edit.kind === "replace" && (before.lat === null || before.lng === null));
      const location =
        changed && address !== null
          ? await locationValues(address, fuzzyLocation)
          : edit.kind === "retain"
            ? {}
            : { fuzzyLocation };
      const participant = await writeTransaction(database, async (tx) => {
        const target = await participantForChange(tx, input);
        if (edit.kind !== "retain" && !sameLocation(before, target))
          throw new AppError("CONFLICT", "Participant location changed; reload and try again");
        return participantSnapshot(
          await tx.participant.update({
            where: { id: target.id },
            data: { ...(input.name === undefined ? {} : { name: input.name }), ...location },
          })
        );
      });
      await notify(input.eventId, { kind: "participant-updated", participant });
      return participant;
    },
    async removeParticipant(input) {
      await writeTransaction(database, async (tx) => {
        const participant = await participantForChange(tx, input);
        if (participant.isOrganizer)
          throw new AppError("FORBIDDEN", "Cannot delete the organizer participant");
        await tx.participant.delete({ where: { id: participant.id } });
      });
      await notify(input.eventId, {
        kind: "participant-removed",
        participantId: input.participantId,
      });
      try {
        const votes = await voteSnapshot(input.eventId);
        await notify(input.eventId, { kind: "votes-updated", votes });
      } catch {
        dependencies.publicationFailed(input.eventId);
      }
    },
    async remove(input) {
      await writeTransaction(database, async (tx) => {
        await authorize(tx, input, true);
        await tx.event.delete({ where: { id: input.eventId } });
      });
    },
    async votes(eventId) {
      const votes = await voteSnapshot(eventId);
      const summaries = await places.summaries(votes.venues.map((venue) => venue.id));
      const venues = votes.venues.map(({ id, voters }) => {
        const place = summaries.get(id);
        if (!place) throw new Error("Vote references a missing place");
        return { ...place, voteCount: voters.length, voters };
      });
      venues.sort((a, b) => b.voteCount - a.voteCount);
      return { venues, totalVotes: votes.totalVotes };
    },
    async authorizeStream(input) {
      await authorize(database, input);
    },
    async directions(input) {
      const participants = await database.$transaction(
        async (tx) => {
          await authorize(tx, input);
          const rows = await tx.participant.findMany({
            where: {
              eventId: input.eventId,
              ...(input.participantId ? { id: input.participantId } : {}),
            },
            orderBy: { createdAt: "asc" },
          });
          if (input.participantId && rows.length === 0)
            throw new AppError("PARTICIPANT_NOT_FOUND", "Participant not found");
          return rows.map(participantSnapshot);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );
      const destination = await places.destination(input.venueId);
      if (destination.kind === "not-found")
        throw new AppError("VALIDATION_ERROR", "Venue not found");
      if (destination.kind === "unavailable")
        throw new AppError("EXTERNAL_SERVICE_ERROR", "Venue lookup is temporarily unavailable");
      const origins = participants.flatMap((participant) =>
        participant.location ? [{ originId: participant.id, point: participant.location }] : []
      );
      const routes = await dependencies.routing.toDestination({
        origins,
        destination: destination.value,
        mode: input.mode,
      });
      const byId = new Map(routes.map(({ originId, ...outcome }) => [originId, outcome]));
      const outcomes: ParticipantRoute[] = participants.map((participant) => ({
        participantId: participant.id,
        ...(participant.location
          ? (byId.get(participant.id) ?? { kind: "unavailable" })
          : { kind: "no-location" }),
      }));
      return { venueId: input.venueId, mode: input.mode, outcomes };
    },
  };
}
