import { parseArgs } from "node:util";
import type { MoveOutcome } from "../src/services/move-approximate-areas.js";
import { EVENT_ID_PATTERN } from "../src/utils/id.js";

const USAGE = `Usage: npx tsx scripts/move-approximate-areas.ts [options]

Gives each approximate participant a new area. Without --write it only counts.

Options:
  --write              saves the new areas
  --event=<id>         limits the run to one event
  --clear-unresolved   clears the location when the address is not found
  --forget-addresses   removes the stored address after moving; the move can't be recomputed later
  --help               shows this help

Environment: DATABASE_URL, REDIS_URL, LOCATION_SHIFT_SECRET (at least 32 bytes)
`;

const MIN_SECRET_BYTES = 32;

const LABELS: Record<MoveOutcome, string> = {
  alreadyMoved: "Skipped, moved by an earlier run",
  wouldMove: "Would move",
  notCached: "Not in the geocode cache",
  moved: "Moved, stored address kept",
  movedAddressRemoved: "Moved, stored address removed",
  changedDuringRun: "Left alone, changed or removed during the run",
  notFound: "Left alone, address not found",
  cleared: "Location cleared, address not found",
  lookupFailed: "Left alone, address lookup failed",
};

function parseOptions() {
  try {
    return parseArgs({
      options: {
        write: { type: "boolean", default: false },
        event: { type: "string" },
        "clear-unresolved": { type: "boolean", default: false },
        "forget-addresses": { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
      strict: true,
    }).values;
  } catch {
    return undefined;
  }
}

function envProblems(secret: string): string[] {
  const missing = (["DATABASE_URL", "REDIS_URL", "LOCATION_SHIFT_SECRET"] as const)
    .filter((name) => !process.env[name])
    .map((name) => `${name} is not set\n`);
  const tooShort =
    secret && Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES
      ? [`LOCATION_SHIFT_SECRET must be at least ${String(MIN_SECRET_BYTES)} bytes\n`]
      : [];
  return [...missing, ...tooShort];
}

async function main(): Promise<number> {
  const options = parseOptions();
  if (!options) {
    process.stderr.write(USAGE);
    return 1;
  }
  if (options.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (options.event !== undefined && !EVENT_ID_PATTERN.test(options.event)) {
    process.stderr.write("--event must be an event ID like evt_1702000000000_a8K3mX2pQrS7nBvW\n");
    return 1;
  }
  const secret = process.env.LOCATION_SHIFT_SECRET ?? "";
  const problems = envProblems(secret);
  if (problems.length > 0) {
    process.stderr.write(problems.join(""));
    return 1;
  }

  const { redis, checkRedisHealth, disconnectRedis } = await import("../src/lib/redis.js");
  // The shared client logs connection events to stdout and stderr; this command prints counts only.
  for (const event of ["connect", "reconnecting", "error"]) {
    redis.removeAllListeners(event);
  }
  redis.on("error", () => undefined);
  const { prisma, disconnectPrisma } = await import("../src/lib/prisma.js");
  const { moveApproximateAreas } = await import("../src/services/move-approximate-areas.js");

  try {
    if (!(await checkRedisHealth())) {
      process.stderr.write("Redis is not reachable\n");
      return 1;
    }
    const counts = await moveApproximateAreas(prisma, {
      write: options.write,
      eventId: options.event,
      clearUnresolved: options["clear-unresolved"],
      forgetAddresses: options["forget-addresses"],
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
    return 0;
  } catch (error) {
    // Database error messages can quote query arguments, so print only the error type
    console.error(`Failed with ${error instanceof Error ? error.name : "a non-Error value"}`);
    return 1;
  } finally {
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  }
}

process.exitCode = await main();
