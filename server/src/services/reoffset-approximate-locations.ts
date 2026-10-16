/**
 * One-off that gives every approximate participant a new random area.
 *
 * Areas stored before `utils/approximate-location` used the old offset. This
 * re-geocodes each saved address through the cached `geocode` and stores a fresh
 * area. `scripts/reoffset-approximate-locations.ts` runs it. Delete both once the
 * production run is done.
 * @module services/reoffset-approximate-locations
 */

import type { PrismaClient } from "@prisma/client";
import { geocode } from "../lib/maps.js";
import { approximateLocation } from "../utils/approximate-location.js";

export interface ReoffsetCounts {
  /** Approximate participants with a saved address */
  approximate: number;
  /** Left alone because their address did not geocode */
  geocodeFailed: number;
  /** Left alone because their address or approximate setting changed mid-run */
  editedDuringRun: number;
  /** Given a new area, or on a dry run, the number that would be */
  moved: number;
}

/**
 * Gives approximate participants a new random area.
 * @param db - Prisma client
 * @param options - Run options
 * @param options.write - Saves the new areas when true, only counts when false
 * @param options.eventId - Limits the run to one event
 * @returns Counts only, so callers never print addresses or coordinates
 */
export async function reoffsetApproximateLocations(
  db: PrismaClient,
  { write, eventId }: { write: boolean; eventId?: string }
): Promise<ReoffsetCounts> {
  const rows = await db.participant.findMany({
    where: { eventId, fuzzyLocation: true },
    select: { id: true, address: true },
  });
  const participants = rows.filter(
    (row): row is { id: string; address: string } => row.address !== null
  );
  const counts: ReoffsetCounts = {
    approximate: participants.length,
    geocodeFailed: 0,
    editedDuringRun: 0,
    moved: 0,
  };

  for (const { id, address } of participants) {
    const exact = await geocode(address).catch(() => null);
    if (!exact) {
      counts.geocodeFailed++;
      continue;
    }

    if (!write) {
      counts.moved++;
      continue;
    }

    const { lat, lng } = approximateLocation(exact);
    const { count } = await db.participant.updateMany({
      where: { id, address, fuzzyLocation: true },
      data: { lat, lng },
    });
    if (count === 1) {
      counts.moved++;
    } else {
      counts.editedDuringRun++;
    }
  }

  return counts;
}
