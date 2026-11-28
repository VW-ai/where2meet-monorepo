/**
 * Copies free events from each source into free_event.
 *
 * Rows upsert on (source, source_id), so running the job twice stores each event once.
 * A source that cannot be read is logged and the others still run; a database error is
 * not caught, since every later write would fail the same way.
 * @module services/free-events/ingest
 */

import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import type { FreeEventRow, FreeEventSource } from "./types.js";

/** One source's outcome, for the job's exit summary. */
export type SourceOutcome =
  | { source: string; ok: true; upserted: number; skipped: number }
  | { source: string; ok: false; error: string };

async function upsertRow(db: PrismaClient, source: string, row: FreeEventRow): Promise<void> {
  const fields = {
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    venueName: row.venueName,
    placeId: row.placeId,
    lat: row.lat,
    lng: row.lng,
    kind: row.kind,
    url: row.url,
  };
  await db.freeEvent.upsert({
    where: { source_sourceId: { source, sourceId: row.sourceId } },
    create: {
      source,
      sourceId: row.sourceId,
      ...fields,
      status: row.cancelled ? "hidden" : "live",
    },
    // A row someone hid stays hidden; only a cancellation changes status from here.
    update: row.cancelled ? { ...fields, status: "hidden" } : fields,
  });
}

/** Node's fetch reports only "fetch failed"; the cause says whether DNS, the connection or a timeout broke. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  return err.cause instanceof Error ? `${err.message}: ${err.cause.message}` : err.message;
}

/**
 * Runs every source once.
 * @param db - Prisma client
 * @param sources - The listings to read
 * @param log - Logger for the per-source summary lines
 * @returns One outcome per source, in order
 */
export async function ingestFreeEvents(
  db: PrismaClient,
  sources: FreeEventSource[],
  log: Logger
): Promise<SourceOutcome[]> {
  const outcomes: SourceOutcome[] = [];
  for (const source of sources) {
    let fetched;
    try {
      fetched = await source.fetchRows();
    } catch (err) {
      const error = describeError(err);
      log.error(
        { source: source.name, error },
        `ingest failed source=${source.name} error=${error}`
      );
      outcomes.push({ source: source.name, ok: false, error });
      continue;
    }
    for (const row of fetched.rows) {
      await upsertRow(db, source.name, row);
    }
    const upserted = fetched.rows.length;
    const { skipped } = fetched;
    log.info(
      { source: source.name, upserted, skipped },
      `ingest done source=${source.name} upserted=${String(upserted)} skipped=${String(skipped)}`
    );
    outcomes.push({ source: source.name, ok: true, upserted, skipped });
  }
  return outcomes;
}
