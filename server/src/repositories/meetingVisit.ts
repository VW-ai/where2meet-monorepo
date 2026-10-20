/**
 * Meeting visit repository module.
 *
 * Handles database operations for MeetingVisit rows, one per meeting-page stream.
 * @module repositories/meetingVisit
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Data for recording the start of a meeting visit.
 */
export interface CreateMeetingVisitData {
  id: string;
  eventId: string;
  participantId: string;
  at: Date;
}

/**
 * Repository for MeetingVisit database operations.
 */
export class MeetingVisitRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Inserts a visit that starts and was last seen at the given time.
   * Both times come from the app clock so last_seen_at - started_at never mixes two clocks.
   * @param visit - Visit ID, meeting, participant and start time
   */
  async create(visit: CreateMeetingVisitData): Promise<void> {
    await this.db.meetingVisit.create({
      data: {
        id: visit.id,
        eventId: visit.eventId,
        participantId: visit.participantId,
        startedAt: visit.at,
        lastSeenAt: visit.at,
      },
    });
  }

  /**
   * Moves a visit's last_seen_at forward.
   * Uses updateMany so a visit whose insert failed matches no row instead of throwing.
   * @param id - Visit ID
   * @param at - Time the visit was last seen
   */
  async touch(id: string, at: Date): Promise<void> {
    await this.db.meetingVisit.updateMany({
      where: { id },
      data: { lastSeenAt: at },
    });
  }
}

/**
 * Factory function to create a MeetingVisitRepository instance.
 * @param db - Prisma client instance
 * @returns MeetingVisitRepository instance
 */
export function createMeetingVisitRepository(db: PrismaClient): MeetingVisitRepository {
  return new MeetingVisitRepository(db);
}
