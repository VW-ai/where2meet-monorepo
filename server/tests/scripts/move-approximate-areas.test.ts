import { describe, it, expect, beforeEach } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/lib/prisma.js";
import { redis } from "../../src/lib/redis.js";
import { generateEventId } from "../../src/utils/id.js";

const SERVER_DIR = fileURLToPath(new URL("../..", import.meta.url));
const SECRET = "test-location-shift-secret-0123456789";

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

const countLines = (counts: Record<string, number>) =>
  [
    ["Approximate participants with an address", counts.total],
    ["Skipped, moved by an earlier run", counts.alreadyMoved],
    ["Would move", counts.wouldMove],
    ["Not in the geocode cache", counts.notCached],
    ["Moved, stored address kept", counts.moved],
    ["Moved, stored address removed", counts.movedAddressRemoved],
    ["Left alone, changed or removed during the run", counts.changedDuringRun],
    ["Left alone, address not found", counts.notFound],
    ["Location cleared, address not found", counts.cleared],
    ["Left alone, address lookup failed", counts.lookupFailed],
  ].map(([label, count]) => `${String(label)}: ${String(count ?? 0)}`);

const testEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  LOCATION_SHIFT_SECRET: SECRET,
};

function runScript(args: string[], env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/move-approximate-areas.ts", ...args],
      {
        cwd: SERVER_DIR,
        env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...env },
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("scripts/move-approximate-areas", () => {
  it.each([
    [
      "a missing DATABASE_URL",
      { ...testEnv, DATABASE_URL: undefined },
      "DATABASE_URL is not set\n",
    ],
    ["an empty REDIS_URL", { ...testEnv, REDIS_URL: "" }, "REDIS_URL is not set\n"],
    [
      "a missing LOCATION_SHIFT_SECRET",
      { ...testEnv, LOCATION_SHIFT_SECRET: undefined },
      "LOCATION_SHIFT_SECRET is not set\n",
    ],
    [
      "a LOCATION_SHIFT_SECRET under 32 bytes",
      { ...testEnv, LOCATION_SHIFT_SECRET: "short-secret-value" },
      "LOCATION_SHIFT_SECRET must be at least 32 bytes\n",
    ],
  ])(
    "stops before connecting on %s",
    async (_case, env, stderr) => {
      expect(await runScript([], env)).toEqual({ code: 1, stdout: "", stderr });
    },
    30_000
  );

  it("prints the usage on --help without needing the environment", async () => {
    expect(await runScript(["--help"], {})).toEqual({ code: 0, stdout: USAGE, stderr: "" });
  }, 30_000);

  it.each([[["--force"]], [["extra"]]])(
    "prints the usage and stops on %j",
    async (args) => {
      expect(await runScript(args, testEnv)).toEqual({ code: 1, stdout: "", stderr: USAGE });
    },
    30_000
  );

  it("stops on an --event that is not an event ID", async () => {
    expect(await runScript(["--event=nope"], testEnv)).toEqual({
      code: 1,
      stdout: "",
      stderr: "--event must be an event ID like evt_1702000000000_a8K3mX2pQrS7nBvW\n",
    });
  }, 30_000);

  describe("against the database", () => {
    const participants = (eventId: string) =>
      prisma.participant
        .findMany({ where: { eventId }, orderBy: { name: "asc" } })
        .then((rows) =>
          rows.map(({ name, address, lat, lng }) => [name, address, Number(lat), Number(lng)])
        );

    async function seedEvent(people: object[]) {
      const id = generateEventId();
      await prisma.event.create({
        data: { id, title: "Move areas from the command line", participants: { create: people } },
      });
      return id;
    }

    const ana = {
      name: "Ana",
      address: "10 Cedar Ct, Clitown",
      lat: 40.71,
      lng: -74.01,
      fuzzyLocation: true,
      color: "teal",
    };
    const ben = {
      name: "Ben",
      address: "20 Birch Way, Clitown",
      lat: 40.72,
      lng: -74.02,
      fuzzyLocation: true,
      color: "gold",
    };
    const cal = {
      name: "Cal",
      address: "30 Ash Pl, Clitown",
      lat: 40.73,
      lng: -74.03,
      fuzzyLocation: false,
      color: "blue",
    };

    beforeEach(async () => {
      const staleKeys = await redis.keys("geocode:*clitown");
      if (staleKeys.length > 0) await redis.del(...staleKeys);
      await redis.set(
        "geocode:10 cedar ct, clitown",
        JSON.stringify({ lat: 40.7411, lng: -73.9897, formattedAddress: "10 Cedar Court, Clitown" })
      );
    });

    it("prints counts only on a dry run and saves nothing, even with --forget-addresses", async () => {
      const eventId = await seedEvent([ana, ben]);

      const result = await runScript([`--event=${eventId}`, "--forget-addresses"], testEnv);

      expect(result).toEqual({
        code: 0,
        stdout: [
          "[Redis] Connected successfully",
          "Mode: dry run, nothing saved (pass --write to save)",
          ...countLines({ total: 2, wouldMove: 1, notCached: 1 }),
          "",
        ].join("\n"),
        stderr: "",
      });
      expect(await participants(eventId)).toEqual([
        ["Ana", "10 Cedar Ct, Clitown", 40.71, -74.01],
        ["Ben", "20 Birch Way, Clitown", 40.72, -74.02],
      ]);
    }, 30_000);

    it("moves and removes the stored address with --write --forget-addresses", async () => {
      const eventId = await seedEvent([ana, cal]);

      const result = await runScript(
        ["--write", `--event=${eventId}`, "--forget-addresses"],
        testEnv
      );

      expect(result).toEqual({
        code: 0,
        stdout: [
          "[Redis] Connected successfully",
          "Mode: write",
          ...countLines({ total: 1, movedAddressRemoved: 1 }),
          "",
        ].join("\n"),
        stderr: "",
      });
      expect(await participants(eventId)).toEqual([
        ["Ana", null, 40.7532166, -73.998158],
        ["Cal", "30 Ash Pl, Clitown", 40.73, -74.03],
      ]);
    }, 30_000);
  });
});
