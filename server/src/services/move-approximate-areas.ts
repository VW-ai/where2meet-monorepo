/**
 * One-off that gives each approximate participant a new area.
 *
 * `scripts/move-approximate-areas.ts` runs it. Delete both once the production
 * run is done.
 * @module services/move-approximate-areas
 */

import type { PrismaClient } from "@prisma/client";
import { AddressNotFoundError, cachedGeocode, geocode, type GeocodeResult } from "../lib/maps.js";
import { approximateArea } from "../utils/approximate-area.js";
import type { GeoPoint } from "../utils/mec.js";

/** What happened to one approximate participant with a stored address. */
export type MoveOutcome =
  | "wouldMove"
  | "notCached"
  | "moved"
  | "editedDuringRun"
  | "notFound"
  | "cleared"
  | "lookupFailed";

export type MoveCounts = Record<MoveOutcome, number>;

export interface MoveOptions {
  /** Saves changes when true. A dry run reads only the geocode cache. */
  write: boolean;
  /** Limits the run to one event */
  eventId?: string;
  /** Clears the location of participants whose address is not found */
  clearUnresolved: boolean;
  /** Key for `approximateArea` */
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

/**
 * Saves the location only if the participant still has the address and the
 * approximate setting it had when the run read it.
 */
async function saveIfUnchanged(
  db: PrismaClient,
  { id, address }: ApproximateParticipant,
  location: GeoPoint | { lat: null; lng: null }
): Promise<boolean> {
  const { count } = await db.participant.updateMany({
    where: { id, address, fuzzyLocation: true },
    data: location,
  });
  return count === 1;
}

async function move(
  db: PrismaClient,
  participant: ApproximateParticipant,
  { write, clearUnresolved, secret }: MoveOptions
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
  const moved = await saveIfUnchanged(db, participant, approximateArea(exact, secret));
  return moved ? "moved" : "editedDuringRun";
}

/**
 * Gives approximate participants with a stored address a new area.
 * @param db - Prisma client
 * @param options - Run options
 * @returns Counts per outcome only, so callers never print addresses or coordinates
 */
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
