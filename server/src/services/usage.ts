/**
 * Usage service module.
 *
 * Records how people use a meeting page (visits and venue searches) for the owner's
 * internal usage panel. Recording never fails or slows the request it describes.
 * @module services/usage
 */

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createMeetingVisitRepository } from "../repositories/meetingVisit.js";
import { createVenueSearchRepository } from "../repositories/venueSearch.js";
import { createParticipantService } from "./participant.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("UsageService");

/** How often an open visit moves last_seen_at forward, so a crash loses at most this much. */
const VISIT_TOUCH_INTERVAL_MS = 30_000;

/**
 * A meeting visit being recorded for one open stream.
 */
export interface OpenMeetingVisit {
  /** Stops the timer and writes the final last_seen_at. Safe to call more than once. */
  close(): Promise<void>;
}

/**
 * Starts recording a visit for one meeting-page stream.
 *
 * Writes run one at a time in order on a chain owned by the visit, so every touch lands
 * after the insert. Each visit has its own timer rather than the SSE heartbeat, which is
 * shared by all connections and never starts when Redis is down at boot.
 * @param db - Prisma client instance
 * @param eventId - Meeting the stream belongs to
 * @param participantId - Participant whose token opened the stream
 * @returns The open visit; close it when the stream closes
 */
export function openMeetingVisit(
  db: PrismaClient,
  eventId: string,
  participantId: string
): OpenMeetingVisit {
  const visits = createMeetingVisitRepository(db);
  const id = randomUUID();
  const warn = (err: unknown) => {
    logger.warn({ err, eventId, visitId: id }, "Failed to record meeting visit");
  };

  let writes = visits.create({ id, eventId, participantId, at: new Date() }).catch(warn);
  const touch = () => {
    const at = new Date();
    writes = writes.then(() => visits.touch(id, at)).catch(warn);
  };

  const timer = setInterval(touch, VISIT_TOUCH_INTERVAL_MS);
  timer.unref();

  let closed = false;
  return {
    close() {
      if (!closed) {
        closed = true;
        clearInterval(timer);
        touch();
      }
      return writes;
    },
  };
}

/**
 * A successful venue search made from a meeting.
 */
export interface MeetingVenueSearch {
  eventId: string;
  /** Bearer token sent with the search. */
  token: string;
  query: string;
  resultCount: number;
}

/**
 * Records a venue search made by someone in a meeting.
 *
 * Records nothing unless the token belongs to a participant or the organizer of that meeting,
 * so only people in the meeting add rows. It logs a failure and never rejects, so callers can
 * start it without awaiting it.
 * @param db - Prisma client instance
 * @param search - The search to record
 */
export async function recordVenueSearch(
  db: PrismaClient,
  search: MeetingVenueSearch
): Promise<void> {
  const { eventId, token, query, resultCount } = search;
  try {
    const searcher = await createParticipantService(db).findParticipantByTokenWithDetails(
      eventId,
      token
    );
    if (!searcher) return;
    await createVenueSearchRepository(db).create({
      eventId,
      participantId: searcher.participantId,
      query,
      resultCount,
    });
  } catch (err) {
    logger.warn({ err, eventId }, "Failed to record venue search");
  }
}
