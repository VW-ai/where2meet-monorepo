import type { PrismaClient } from "@prisma/client";
import { AddressNotFoundError, cachedGeocode, geocode, type GeocodeResult } from "../lib/maps.js";
import { approximateArea } from "../utils/approximate-area.js";
import type { GeoPoint } from "../utils/mec.js";

export type MoveOutcome =
  | "wouldMove"
  | "notCached"
  | "moved"
  | "movedAddressRemoved"
  | "editedDuringRun"
  | "notFound"
  | "cleared"
  | "lookupFailed";

export type MoveCounts = Record<MoveOutcome, number>;

export interface MoveOptions {
  write: boolean;
  eventId?: string;
  clearUnresolved: boolean;
  forgetAddresses: boolean;
  secret: string;
}

interface ApproximateParticipant {
  id: string;
  address: string;
}

async function lookUp(address: string): Promise<GeocodeResult | "notFound" | "lookupFailed"> {
  try {
    return await geocode(address);
  } catch (error) {
    return error instanceof AddressNotFoundError ? "notFound" : "lookupFailed";
  }
}

async function saveIfUnchanged(
  db: PrismaClient,
  { id, address }: ApproximateParticipant,
  change: (GeoPoint | { lat: null; lng: null }) & { address?: null; formattedAddress?: null }
): Promise<boolean> {
  const { count } = await db.participant.updateMany({
    where: { id, address, fuzzyLocation: true },
    data: change,
  });
  return count === 1;
}

async function move(
  db: PrismaClient,
  participant: ApproximateParticipant,
  { write, clearUnresolved, forgetAddresses, secret }: MoveOptions
): Promise<MoveOutcome> {
  if (!write) {
    return (await cachedGeocode(participant.address)) ? "wouldMove" : "notCached";
  }

  const exact = await lookUp(participant.address);
  if (exact === "lookupFailed") {
    return "lookupFailed";
  }
  if (exact === "notFound") {
    if (!clearUnresolved) {
      return "notFound";
    }
    const cleared = await saveIfUnchanged(db, participant, { lat: null, lng: null });
    return cleared ? "cleared" : "editedDuringRun";
  }
  const area = approximateArea(exact, secret);
  const change = forgetAddresses ? { ...area, address: null, formattedAddress: null } : area;
  if (!(await saveIfUnchanged(db, participant, change))) {
    return "editedDuringRun";
  }
  return forgetAddresses ? "movedAddressRemoved" : "moved";
}

export async function moveApproximateAreas(
  db: PrismaClient,
  options: MoveOptions
): Promise<MoveCounts> {
  const rows = await db.participant.findMany({
    where: { eventId: options.eventId, fuzzyLocation: true },
    select: { id: true, address: true },
  });
  const counts: MoveCounts = {
    wouldMove: 0,
    notCached: 0,
    moved: 0,
    movedAddressRemoved: 0,
    editedDuringRun: 0,
    notFound: 0,
    cleared: 0,
    lookupFailed: 0,
  };

  for (const row of rows) {
    if (row.address !== null) {
      counts[await move(db, { id: row.id, address: row.address }, options)]++;
    }
  }

  return counts;
}
