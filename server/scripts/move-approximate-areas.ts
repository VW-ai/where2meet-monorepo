import { parseArgs } from "node:util";
import type { MoveOutcome } from "../src/services/move-approximate-areas.js";
import { EVENT_ID_PATTERN } from "../src/utils/id.js";

const USAGE = `Usage: npx tsx scripts/move-approximate-areas.ts [--write] [--event=<id>] [--clear-unresolved]

Gives each approximate participant a new area. Without --write it only counts.

Options:
  --write              save the new areas
  --event=<id>         only participants of this event
  --clear-unresolved   clear the location when the address is not found

Environment: DATABASE_URL, REDIS_URL, LOCATION_SHIFT_SECRET (at least 32 bytes)
`;

const MIN_SECRET_BYTES = 32;

const LABELS: Record<MoveOutcome, string> = {
  wouldMove: "Would move",
  notCached: "Not in the geocode cache",
  moved: "Moved",
  editedDuringRun: "Left alone, edited during the run",
  notFound: "Left alone, address not found",
  cleared: "Location cleared, address not found",
  lookupFailed: "Left alone, address lookup failed",
};

function stop(message: string): never {
  process.stderr.write(message);
  process.exit(1);
}

function parseOptions() {
  try {
    return parseArgs({
      options: {
        write: { type: "boolean", default: false },
        event: { type: "string" },
        "clear-unresolved": { type: "boolean", default: false },
      },
      strict: true,
    }).values;
  } catch {
    return stop(USAGE);
  }
}

const options = parseOptions();
if (options.event !== undefined && !EVENT_ID_PATTERN.test(options.event)) {
  stop("--event must be an event ID like evt_1702000000000_a8K3mX2pQrS7nBvW\n");
}

const secret = process.env.LOCATION_SHIFT_SECRET ?? "";
const envProblems = [
  ...(["DATABASE_URL", "REDIS_URL", "LOCATION_SHIFT_SECRET"] as const)
    .filter((name) => !process.env[name])
    .map((name) => `${name} is not set\n`),
  ...(secret && Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES
    ? [`LOCATION_SHIFT_SECRET must be at least ${String(MIN_SECRET_BYTES)} bytes\n`]
    : []),
];
if (envProblems.length > 0) {
  stop(envProblems.join(""));
}

// Imported only now: the Redis client falls back to localhost when REDIS_URL is unset.
const { prisma, disconnectPrisma } = await import("../src/lib/prisma.js");
const { disconnectRedis } = await import("../src/lib/redis.js");
const { moveApproximateAreas } = await import("../src/services/move-approximate-areas.js");

try {
  const counts = await moveApproximateAreas(prisma, {
    write: options.write,
    eventId: options.event,
    clearUnresolved: options["clear-unresolved"],
    secret,
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  process.stdout.write(
    [
      options.write ? "Mode: write" : "Mode: dry run, nothing saved (pass --write to save)",
      `Approximate participants with an address: ${String(total)}`,
      ...Object.entries(LABELS).map(
        ([outcome, label]) => `${label}: ${String(counts[outcome as MoveOutcome])}`
      ),
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
