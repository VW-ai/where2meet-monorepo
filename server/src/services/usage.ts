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
import { createLogger } from "../lib/logger.js";

const logger = createLogger("UsageService");

/** How often an open visit moves last_seen_at forward, so a crash loses at most this much. */
export const VISIT_TOUCH_INTERVAL_MS = 30_000;

/**
 * A meeting visit being recorded for one open stream.
 */
export interface MeetingVisit {
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
): MeetingVisit {
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
