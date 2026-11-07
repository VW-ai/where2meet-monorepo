/**
 * Whether someone can take over a participant row with "That's me".
 *
 * A row the organizer added holds no token until its person claims it. Claimable
 * is derived from those two columns and never stored, so it cannot drift.
 * @module utils/claimable
 */

import type { Participant } from "@prisma/client";

/** Prisma filter form of {@link isClaimable}, for atomic conditional writes. */
export const CLAIMABLE_WHERE = { tokenHash: null, isOrganizer: false } as const;

/**
 * @param participant - Row to check
 * @returns True when nobody holds the row and it is not the organizer's
 */
export function isClaimable(participant: Pick<Participant, "tokenHash" | "isOrganizer">): boolean {
  return participant.tokenHash === null && !participant.isOrganizer;
}
