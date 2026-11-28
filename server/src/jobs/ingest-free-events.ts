/**
 * One-shot job: ingest free NYC events, then exit.
 *
 * A Railway cron service runs it daily (railway.cron.toml). It exits 0 when a source is
 * down, since the next day's run retries and the per-source log line shows the gap. It
 * exits 1 only when the database fails.
 *
 * Usage: node dist/jobs/ingest-free-events.js
 * FREE_EVENTS_NYC_PARKS_URL points the Parks source at another URL, for drills.
 * @module jobs/ingest-free-events
 */

import "dotenv/config";
import { prisma, disconnectPrisma } from "../lib/prisma.js";
import { createLogger } from "../lib/logger.js";
import { ingestFreeEvents } from "../services/free-events/ingest.js";
import { nycParksSource } from "../services/free-events/nyc-parks.js";

const log = createLogger("ingest-free-events");

async function main(): Promise<void> {
  const sources = [nycParksSource(process.env.FREE_EVENTS_NYC_PARKS_URL)];
  const started = Date.now();
  const outcomes = await ingestFreeEvents(prisma, sources, log);
  log.info(
    { ms: Date.now() - started, failed: outcomes.filter((o) => !o.ok).map((o) => o.source) },
    "ingest finished"
  );
}

main()
  .then(() => disconnectPrisma())
  .then(() => process.exit(0))
  .catch(async (err: unknown) => {
    log.fatal({ err }, "ingest aborted");
    await disconnectPrisma().catch(() => undefined);
    process.exit(1);
  });
