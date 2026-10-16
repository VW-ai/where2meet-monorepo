/**
 * One-off: gives every approximate participant a new random area.
 *
 *   npx tsx scripts/reoffset-approximate-locations.ts                 # dry run, counts only
 *   npx tsx scripts/reoffset-approximate-locations.ts --write         # saves the new areas
 *   npx tsx scripts/reoffset-approximate-locations.ts --event=<id>    # one event only
 *
 * Reads DATABASE_URL, REDIS_URL, and GOOGLE_MAPS_API_KEY from the environment.
 * Prints counts only, never addresses or coordinates.
 */

import { parseArgs } from "node:util";
import { disconnectPrisma, prisma } from "../src/lib/prisma.js";
import { disconnectRedis } from "../src/lib/redis.js";
import { reoffsetApproximateLocations } from "../src/services/reoffset-approximate-locations.js";

// strict: a mistyped flag stops the run instead of widening it to every event
const { values } = parseArgs({
  options: { write: { type: "boolean", default: false }, event: { type: "string" } },
  strict: true,
});

try {
  const counts = await reoffsetApproximateLocations(prisma, {
    write: values.write,
    eventId: values.event,
  });
  process.stdout.write(
    [
      values.write ? "Mode: write" : "Mode: dry run, nothing saved (pass --write to save)",
      `Approximate participants with an address: ${String(counts.approximate)}`,
      `Left alone, geocoding failed: ${String(counts.geocodeFailed)}`,
      `Left alone, edited during the run: ${String(counts.editedDuringRun)}`,
      `${values.write ? "Moved" : "Would move"}: ${String(counts.moved)}`,
      "",
    ].join("\n")
  );
} catch (error) {
  // Database error messages can quote query arguments, so print only the error type
  console.error(`Failed with ${error instanceof Error ? error.name : "a non-Error value"}`);
  process.exitCode = 1;
} finally {
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
}
