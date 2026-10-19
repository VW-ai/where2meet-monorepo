import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { redis } from "../../src/lib/redis.js";
import { toParticipantResponse } from "../../src/mappers/event.mapper.js";
import { generateEventId } from "../../src/utils/id.js";
import { moveApproximateAreas } from "../../src/services/move-approximate-areas.js";

const SECRET = "test-location-shift-secret-0123456789";

const NO_COUNTS = {
  wouldMove: 0,
  notCached: 0,
  moved: 0,
  editedDuringRun: 0,
  notFound: 0,
  cleared: 0,
  lookupFailed: 0,
};

const GOOGLE_ANSWERS: Record<string, object> = {
  "1 Nowhere Ln, Testville": { status: "ZERO_RESULTS", results: [] },
  "2 Denied Rd, Testville": { status: "REQUEST_DENIED", error_message: "denied", results: [] },
  "789 Pine Rd, Testville": {
    status: "OK",
    results: [
      {
        formatted_address: "789 Pine Road, Testville",
        geometry: { location: { lat: 40.73, lng: -73.99 } },
      },
    ],
  },
};

let googleCalls: string[];
let beforeGoogleAnswers: (address: string) => Promise<void>;

const testvilleKeys = async () => (await redis.keys("geocode:*testville")).sort();

async function seedEvent(participants: object[]) {
  const id = generateEventId();
  await prisma.event.create({
    data: { id, title: "Move areas", participants: { create: participants } },
  });
  return id;
}

async function rows(eventId: string) {
  const participants = await prisma.participant.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
  });
  return participants.map(({ name, address, lat, lng, fuzzyLocation }) => ({
    name,
    address,
    lat: lat === null ? null : Number(lat),
    lng: lng === null ? null : Number(lng),
    fuzzyLocation,
  }));
}

const seededRows = [
  { name: "Ana", address: "456 Oak Ave, Testville", lat: 40.71, lng: -74.01, fuzzyLocation: true },
  { name: "Ben", address: "1 Nowhere Ln, Testville", lat: 40.72, lng: -74.02, fuzzyLocation: true },
  { name: "Cal", address: "12 Elm St, Testville", lat: 40.73, lng: -74.03, fuzzyLocation: false },
  { name: "Dee", address: "2 Denied Rd, Testville", lat: 40.74, lng: -74.04, fuzzyLocation: true },
  { name: "Eve", address: "789 Pine Rd, Testville", lat: 40.75, lng: -74.05, fuzzyLocation: true },
  { name: "Org", address: null, lat: null, lng: null, fuzzyLocation: true },
];

describe("moveApproximateAreas", () => {
  let eventId: string;

  beforeEach(async () => {
    googleCalls = [];
    beforeGoogleAnswers = async () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const address = new URL(url).searchParams.get("address") ?? "";
        googleCalls.push(address);
        await beforeGoogleAnswers(address);
        return { ok: true, json: async () => GOOGLE_ANSWERS[address] } as Response;
      })
    );

    const staleKeys = await testvilleKeys();
    if (staleKeys.length > 0) await redis.del(...staleKeys);
    await redis.set(
      "geocode:456 oak ave, testville",
      JSON.stringify({ lat: 40.7128, lng: -74.006, formattedAddress: "456 Oak Avenue, Testville" })
    );
    await redis.set(
      "geocode:456 oak avenue, testville",
      JSON.stringify({ lat: 40.7128, lng: -74.006, formattedAddress: "456 Oak Avenue, Testville" })
    );

    eventId = await seedEvent(
      seededRows.map((row, index) => ({
        ...row,
        color: `c${String(index)}`,
        isOrganizer: row.name === "Org",
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts on a dry run from the geocode cache only and changes nothing", async () => {
    const counts = await moveApproximateAreas(prisma, {
      write: false,
      eventId,
      clearUnresolved: true,
      secret: SECRET,
    });

    expect({
      counts,
      rows: await rows(eventId),
      googleCalls,
      cacheKeys: await testvilleKeys(),
    }).toEqual({
      counts: { ...NO_COUNTS, wouldMove: 1, notCached: 3 },
      rows: seededRows,
      googleCalls: [],
      cacheKeys: ["geocode:456 oak ave, testville", "geocode:456 oak avenue, testville"],
    });
  });

  it("moves approximate participants with an address and leaves everyone else alone", async () => {
    const counts = await moveApproximateAreas(prisma, {
      write: true,
      eventId,
      clearUnresolved: false,
      secret: SECRET,
    });

    expect({ counts, rows: await rows(eventId), googleCalls: googleCalls.sort() }).toEqual({
      counts: { ...NO_COUNTS, moved: 2, notFound: 1, lookupFailed: 1 },
      rows: [
        { ...seededRows[0], lat: 40.7111034, lng: -74.0153564 },
        seededRows[1],
        seededRows[2],
        seededRows[3],
        { ...seededRows[4], lat: 40.7366183, lng: -74.0003114 },
        seededRows[5],
      ],
      googleCalls: ["1 Nowhere Ln, Testville", "2 Denied Rd, Testville", "789 Pine Rd, Testville"],
    });
  });

  it("gives the same area to participants of different events at the same exact point", async () => {
    const otherEventId = await seedEvent([
      {
        name: "Zed",
        address: "456 Oak Avenue, Testville",
        lat: 40.7,
        lng: -74.1,
        fuzzyLocation: true,
        color: "teal",
      },
    ]);

    await moveApproximateAreas(prisma, {
      write: true,
      eventId,
      clearUnresolved: false,
      secret: SECRET,
    });
    await moveApproximateAreas(prisma, {
      write: true,
      eventId: otherEventId,
      clearUnresolved: false,
      secret: SECRET,
    });

    expect([(await rows(eventId))[0], ...(await rows(otherEventId))]).toEqual([
      { ...seededRows[0], lat: 40.7111034, lng: -74.0153564 },
      {
        name: "Zed",
        address: "456 Oak Avenue, Testville",
        lat: 40.7111034,
        lng: -74.0153564,
        fuzzyLocation: true,
      },
    ]);
  });

  it("stores the same areas when it runs again with the same secret", async () => {
    const options = { write: true, eventId, clearUnresolved: false, secret: SECRET };
    await moveApproximateAreas(prisma, options);
    const afterFirstRun = await rows(eventId);

    const secondCounts = await moveApproximateAreas(prisma, options);

    expect({ secondCounts, rows: await rows(eventId) }).toEqual({
      secondCounts: { ...NO_COUNTS, moved: 2, notFound: 1, lookupFailed: 1 },
      rows: afterFirstRun,
    });
    expect(afterFirstRun[4]).toEqual({ ...seededRows[4], lat: 40.7366183, lng: -74.0003114 });
  });

  it("leaves a participant alone whose address changes during the run", async () => {
    beforeGoogleAnswers = async (address) => {
      if (address === "789 Pine Rd, Testville") {
        await prisma.participant.updateMany({
          where: { eventId, name: "Eve" },
          data: { address: "12 New St, Testville" },
        });
      }
    };

    const counts = await moveApproximateAreas(prisma, {
      write: true,
      eventId,
      clearUnresolved: false,
      secret: SECRET,
    });

    expect({ counts, eve: (await rows(eventId))[4] }).toEqual({
      counts: { ...NO_COUNTS, moved: 1, editedDuringRun: 1, notFound: 1, lookupFailed: 1 },
      eve: { ...seededRows[4], address: "12 New St, Testville" },
    });
  });

  it("clears the location only where the address is not found, and keeps that participant hidden", async () => {
    const counts = await moveApproximateAreas(prisma, {
      write: true,
      eventId,
      clearUnresolved: true,
      secret: SECRET,
    });
    const ben = await prisma.participant.findFirstOrThrow({ where: { eventId, name: "Ben" } });

    expect({ counts, rows: await rows(eventId) }).toEqual({
      counts: { ...NO_COUNTS, moved: 2, cleared: 1, lookupFailed: 1 },
      rows: [
        { ...seededRows[0], lat: 40.7111034, lng: -74.0153564 },
        { ...seededRows[1], lat: null, lng: null },
        seededRows[2],
        seededRows[3],
        { ...seededRows[4], lat: 40.7366183, lng: -74.0003114 },
        seededRows[5],
      ],
    });
    expect(toParticipantResponse(ben)).toEqual({
      id: ben.id,
      name: "Ben",
      address: null,
      location: null,
      color: "c1",
      fuzzyLocation: true,
      isOrganizer: false,
    });
  });
});
