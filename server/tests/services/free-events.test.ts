/**
 * Free event ingest: the Parks adapter maps a recorded response, and the ingest stores each
 * event once however often it runs.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import pino from "pino";
import { prisma } from "../../src/lib/prisma.js";
import { ingestFreeEvents } from "../../src/services/free-events/ingest.js";
import { mapParksEvents, nyLocalToUtc } from "../../src/services/free-events/nyc-parks.js";
import type { FreeEventSource } from "../../src/services/free-events/types.js";

const parksFixture: Record<string, unknown>[] = JSON.parse(
  readFileSync(new URL("../fixtures/free-events/nyc-parks.json", import.meta.url), "utf8")
);
const silent = pino({ level: "silent" });
// Other test files share the free_event table, so this file touches only its own source.
const SOURCE = "test-ingest";
const mine = { source: { in: [SOURCE, "down"] } };

function fixtureSource(name: string, raw: unknown[] = parksFixture): FreeEventSource {
  return { name, fetchRows: () => Promise.resolve(mapParksEvents(raw)) };
}

const downSource: FreeEventSource = {
  name: "down",
  fetchRows: () => Promise.reject(new Error("answered 500")),
};

describe("NYC Parks mapping", () => {
  it("keeps free food and talks and leaves out paid, unrelated and bring-your-own rows", () => {
    const { rows, skipped } = mapParksEvents(parksFixture);

    expect(rows.map((row) => [row.sourceId, row.kind])).toEqual([
      ["2319215", "free-food"], // "refreshments will be served"
      ["2192278", "free-talk"], // category Talks
      ["2295151", "free-food"], // title Hot Cocoa
      ["2321914", "free-food"], // "Dinner will be provided" beats its Talks category
    ]);
    // A $15 author talk, a fitness class, "bring water and snacks", two $10 fairs, a $5 exhibition.
    expect(skipped).toBe(6);
  });

  it("maps time, place and link the way a map pin needs them", () => {
    const paintAndSip = mapParksEvents(parksFixture).rows[0];

    expect(paintAndSip).toMatchObject({
      title: "Paint and Sip",
      startsAt: new Date("2026-12-02T22:30:00.000Z"),
      endsAt: new Date("2026-12-03T00:30:00.000Z"),
      venueName: "Williamsbridge Oval",
      placeId: null,
      url: expect.stringMatching(/^https:\/\/www\.nycgovparks\.org\/events\//),
      cancelled: false,
    });
    expect(paintAndSip?.lat).toBeCloseTo(40.8767, 4);
    expect(paintAndSip?.lng).toBeCloseTo(-73.8785, 4);
  });

  it("decodes HTML entities in titles", () => {
    const workshop = mapParksEvents(parksFixture).rows.find((row) => row.sourceId === "2321914");
    expect(workshop?.title).toMatch(/^Workshop for Volunteers–Let’s Get Outside/);
  });

  it("marks a cancelled listing and drops the prefix from its title", () => {
    const cancelled = { ...parksFixture[0], guid: "1", title: "CANCELLED: Paint and Sip" };
    const [row] = mapParksEvents([cancelled]).rows;
    expect(row).toMatchObject({ title: "Paint and Sip", cancelled: true });
  });

  it("reads New York wall-clock times in both winter and summer", () => {
    expect(nyLocalToUtc("2026-01-15T09:00:00.000")).toEqual(new Date("2026-01-15T14:00:00Z"));
    expect(nyLocalToUtc("2026-07-04T09:00:00.000")).toEqual(new Date("2026-07-04T13:00:00Z"));
    // The hour after the March switch to daylight time.
    expect(nyLocalToUtc("2026-03-08T03:30:00")).toEqual(new Date("2026-03-08T07:30:00Z"));
  });

  it("refuses a body that is not a list", () => {
    expect(() => mapParksEvents({ error: true })).toThrow();
  });
});

describe("ingestFreeEvents", () => {
  beforeEach(async () => {
    await prisma.freeEvent.deleteMany({ where: mine });
  });

  afterAll(async () => {
    await prisma.freeEvent.deleteMany({ where: mine });
  });

  it("stores each event once when run twice", async () => {
    const first = await ingestFreeEvents(prisma, [fixtureSource(SOURCE)], silent);
    const second = await ingestFreeEvents(prisma, [fixtureSource(SOURCE)], silent);

    expect(first).toEqual([{ source: SOURCE, ok: true, upserted: 4, skipped: 6 }]);
    expect(second).toEqual(first);
    expect(await prisma.freeEvent.count({ where: mine })).toBe(4);
  });

  it("keeps a hidden row hidden on the next run", async () => {
    await ingestFreeEvents(prisma, [fixtureSource(SOURCE)], silent);
    await prisma.freeEvent.updateMany({
      where: { sourceId: "2319215" },
      data: { status: "hidden" },
    });

    await ingestFreeEvents(prisma, [fixtureSource(SOURCE)], silent);

    const row = await prisma.freeEvent.findFirstOrThrow({
      where: { source: SOURCE, sourceId: "2319215" },
    });
    expect(row.status).toBe("hidden");
  });

  it("hides a stored event once its listing says cancelled", async () => {
    await ingestFreeEvents(prisma, [fixtureSource(SOURCE)], silent);
    const cancelled = { ...parksFixture[0], title: "CANCELLED: Paint and Sip" };

    await ingestFreeEvents(prisma, [fixtureSource(SOURCE, [cancelled])], silent);

    const row = await prisma.freeEvent.findFirstOrThrow({
      where: { source: SOURCE, sourceId: "2319215" },
    });
    expect(row.status).toBe("hidden");
  });

  it("still ingests the other sources when one is down", async () => {
    const outcomes = await ingestFreeEvents(prisma, [downSource, fixtureSource(SOURCE)], silent);

    expect(outcomes).toEqual([
      { source: "down", ok: false, error: "answered 500" },
      { source: SOURCE, ok: true, upserted: 4, skipped: 6 },
    ]);
    expect(await prisma.freeEvent.count({ where: mine })).toBe(4);
  });
});
