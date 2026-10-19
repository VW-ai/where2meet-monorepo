import { describe, it, expect, beforeEach } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/lib/prisma.js";
import { redis } from "../../src/lib/redis.js";
import { generateEventId } from "../../src/utils/id.js";

const SERVER_DIR = fileURLToPath(new URL("../..", import.meta.url));
const SECRET = "test-location-shift-secret-0123456789";

const USAGE = `Usage: npx tsx scripts/move-approximate-areas.ts [--write] [--event=<id>] [--clear-unresolved]

Gives each approximate participant a new area. Without --write it only counts.

Options:
  --write              save the new areas
  --event=<id>         only participants of this event
  --clear-unresolved   clear the location when the address is not found

Environment: DATABASE_URL, REDIS_URL, LOCATION_SHIFT_SECRET (at least 32 bytes)
`;

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
    let eventId: string;

    beforeEach(async () => {
      const staleKeys = await redis.keys("geocode:*clitown");
      if (staleKeys.length > 0) await redis.del(...staleKeys);
      await redis.set(
        "geocode:10 cedar ct, clitown",
        JSON.stringify({ lat: 40.7411, lng: -73.9897, formattedAddress: "10 Cedar Court, Clitown" })
      );
      eventId = generateEventId();
      await prisma.event.create({
        data: {
          id: eventId,
          title: "Move areas from the command line",
          participants: {
            create: [
              {
                name: "Ana",
                address: "10 Cedar Ct, Clitown",
                lat: 40.71,
                lng: -74.01,
                fuzzyLocation: true,
                color: "teal",
              },
              {
                name: "Ben",
                address: "20 Birch Way, Clitown",
                lat: 40.72,
                lng: -74.02,
                fuzzyLocation: true,
                color: "gold",
              },
            ],
          },
        },
      });
    });

    it("prints counts only on a dry run and saves nothing", async () => {
      const result = await runScript([`--event=${eventId}`], testEnv);
      const saved = await prisma.participant.findMany({
        where: { eventId },
        orderBy: { name: "asc" },
        select: { name: true, lat: true, lng: true },
      });

      expect(result).toEqual({
        code: 0,
        stdout: [
          "[Redis] Connected successfully",
          "Mode: dry run, nothing saved (pass --write to save)",
          "Approximate participants with an address: 2",
          "Would move: 1",
          "Not in the geocode cache: 1",
          "Moved: 0",
          "Left alone, edited during the run: 0",
          "Left alone, address not found: 0",
          "Location cleared, address not found: 0",
          "Left alone, address lookup failed: 0",
          "",
        ].join("\n"),
        stderr: "",
      });
      expect(saved.map(({ name, lat, lng }) => [name, Number(lat), Number(lng)])).toEqual([
        ["Ana", 40.71, -74.01],
        ["Ben", 40.72, -74.02],
      ]);
    }, 30_000);
  });
});
