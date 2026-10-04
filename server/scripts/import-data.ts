import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

const id = z.string().min(1).max(64);
const eventId = z.string().regex(/^evt_\d{13,15}_[a-zA-Z0-9]{16}$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const timestamp = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const decimal = (precision: number, scale: number) =>
  z
    .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)])
    .transform((value) => new Prisma.Decimal(value))
    .refine(
      (value) => value.decimalPlaces() <= scale && value.abs().lt(10 ** (precision - scale)),
      "Decimal exceeds the source column precision"
    );

const event = z.strictObject({
  id: eventId,
  title: z.string().min(1).max(100),
  meetingTime: timestamp.nullable(),
  publishedVenueId: z.string().min(1).max(255).nullable(),
  publishedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
const participant = z.strictObject({
  id: z.uuid(),
  eventId,
  name: z.string().min(1).max(50),
  address: z.string().max(255).nullable(),
  formattedAddress: z.string().max(255).nullable(),
  lat: decimal(10, 7).nullable(),
  lng: decimal(10, 7).nullable(),
  fuzzyLocation: z.boolean(),
  color: z.string().max(20),
  isOrganizer: z.boolean(),
  tokenHash: hash.nullable(),
  createdAt: timestamp,
});
const venue = z.strictObject({
  id: z.string().min(1).max(255),
  name: z.string().max(255),
  address: z.string().max(255).nullable(),
  lat: decimal(10, 7),
  lng: decimal(10, 7),
  category: z.string().max(50).nullable(),
  rating: decimal(2, 1).nullable(),
  priceLevel: z.number().int().min(-32768).max(32767).nullable(),
  photoUrl: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
const vote = z.strictObject({
  id: z.uuid(),
  eventId,
  participantId: z.uuid(),
  venueId: z.string().min(1).max(255),
  createdAt: timestamp,
});
const user = z.strictObject({
  id,
  email: z.string().min(1).max(255),
  name: z.string().max(255).nullable(),
  avatarUrl: z.string().max(512).nullable(),
  emailVerified: z.boolean(),
  defaultAddress: z.string().nullable(),
  defaultPlaceId: z.string().max(255).nullable(),
  defaultFuzzyLocation: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
const identity = z.strictObject({
  id,
  userId: id,
  provider: z.string().min(1).max(50),
  providerId: z.string().min(1).max(255),
  passwordHash: z.string().max(255).nullable(),
  createdAt: timestamp,
});
const session = z.strictObject({
  id,
  userId: id,
  tokenHash: hash,
  expiresAt: timestamp,
  createdAt: timestamp,
});
const userEvent = z.strictObject({
  id,
  userId: id,
  eventId,
  participantId: z.uuid().nullable(),
  role: z.enum(["organizer", "participant"]),
  createdAt: timestamp,
});

const importSchema = z
  .strictObject({
    version: z.literal(1),
    events: z.array(event),
    participants: z.array(participant),
    users: z.array(user),
    userSessions: z.array(session),
    venues: z.array(venue).default([]),
    votes: z.array(vote).default([]),
    userIdentities: z.array(identity).default([]),
    userEvents: z.array(userEvent).default([]),
  })
  .superRefine((pack, context) => {
    for (const [name, rows] of Object.entries(pack)) {
      if (!Array.isArray(rows)) continue;
      const ids = new Set<string>();
      for (const [index, row] of rows.entries()) {
        if (ids.has(row.id)) {
          context.addIssue({
            code: "custom",
            path: [name, index, "id"],
            message: "Duplicate row ID",
          });
        }
        ids.add(row.id);
      }
    }
  });

export type ImportData = z.infer<typeof importSchema>;
export interface ImportCount {
  inserted: number;
  unchanged: number;
}
export type ImportReport = Record<Exclude<keyof ImportData, "version">, ImportCount>;

export class ImportConflictError extends Error {
  constructor(model: string, rowId: string) {
    super(`Import conflict in ${model} for row ${rowId}`);
    this.name = "ImportConflictError";
  }
}

export function parseImportData(input: unknown): ImportData {
  return importSchema.parse(input);
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

async function preserveRows<Row extends { id: string }>(
  model: string,
  rows: Row[],
  find: (rowId: string) => Promise<Row | null>,
  create: (row: Row) => Promise<unknown>
): Promise<ImportCount> {
  const count = { inserted: 0, unchanged: 0 };
  for (const row of rows) {
    const existing = await find(row.id);
    if (existing) {
      if (JSON.stringify(canonical(existing)) !== JSON.stringify(canonical(row))) {
        throw new ImportConflictError(model, row.id);
      }
      count.unchanged++;
    } else {
      await create(row);
      count.inserted++;
    }
  }
  return count;
}

export async function importData(database: PrismaClient, input: unknown): Promise<ImportReport> {
  const pack = parseImportData(input);
  return database.$transaction(
    async (tx) => {
      const users = await preserveRows(
        "User",
        pack.users,
        (rowId) => tx.user.findUnique({ where: { id: rowId } }),
        (row) => tx.user.create({ data: row })
      );
      const venues = await preserveRows(
        "Venue",
        pack.venues,
        (rowId) => tx.venue.findUnique({ where: { id: rowId } }),
        (row) => tx.venue.create({ data: row })
      );
      const events = await preserveRows(
        "Event",
        pack.events,
        (rowId) => tx.event.findUnique({ where: { id: rowId } }),
        (row) => tx.event.create({ data: row })
      );
      const participants = await preserveRows(
        "Participant",
        pack.participants,
        (rowId) => tx.participant.findUnique({ where: { id: rowId } }),
        (row) => tx.participant.create({ data: row })
      );
      const userIdentities = await preserveRows(
        "UserIdentity",
        pack.userIdentities,
        (rowId) => tx.userIdentity.findUnique({ where: { id: rowId } }),
        (row) => tx.userIdentity.create({ data: row })
      );
      const userSessions = await preserveRows(
        "UserSession",
        pack.userSessions,
        (rowId) => tx.userSession.findUnique({ where: { id: rowId } }),
        (row) => tx.userSession.create({ data: row })
      );
      const votes = await preserveRows(
        "Vote",
        pack.votes,
        (rowId) => tx.vote.findUnique({ where: { id: rowId } }),
        (row) => tx.vote.create({ data: row })
      );
      const userEvents = await preserveRows(
        "UserEvent",
        pack.userEvents,
        (rowId) => tx.userEvent.findUnique({ where: { id: rowId } }),
        (row) => tx.userEvent.create({ data: row })
      );

      for (const row of pack.events) {
        if ((row.publishedAt === null) !== (row.publishedVenueId === null)) {
          throw new ImportConflictError("Event publication", row.id);
        }
        if (
          row.publishedVenueId &&
          !(await tx.venue.findUnique({ where: { id: row.publishedVenueId } }))
        ) {
          throw new ImportConflictError("Event venue", row.id);
        }
      }
      for (const row of pack.votes) {
        const owner = await tx.participant.findUnique({ where: { id: row.participantId } });
        if (owner?.eventId !== row.eventId)
          throw new ImportConflictError("Vote participant", row.id);
      }
      for (const row of pack.userEvents) {
        if (row.participantId === null) continue;
        const owner = await tx.participant.findUnique({ where: { id: row.participantId } });
        if (owner?.eventId !== row.eventId || owner.isOrganizer !== (row.role === "organizer")) {
          throw new ImportConflictError("UserEvent participant", row.id);
        }
      }
      return {
        users,
        venues,
        events,
        participants,
        userIdentities,
        userSessions,
        votes,
        userEvents,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 }
  );
}
