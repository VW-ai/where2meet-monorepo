import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { redis } from "../../src/lib/redis.js";
import { toParticipantResponse } from "../../src/mappers/event.mapper.js";
import { generateEventId } from "../../src/utils/id.js";
import {
  moveApproximateAreas,
  type MoveOptions,
} from "../../src/services/move-approximate-areas.js";

const SECRET = "test-location-shift-secret-0123456789";

const NO_COUNTS = {
  alreadyMoved: 0,
  wouldMove: 0,
  notCached: 0,
  moved: 0,
  movedAddressRemoved: 0,
  changedDuringRun: 0,
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
  return participants.map(
    ({ name, address, formattedAddress, lat, lng, fuzzyLocation, approximateAreaMovedAt }) => ({
      name,
      address,
      formattedAddress,
      lat: lat === null ? null : Number(lat),
      lng: lng === null ? null : Number(lng),
      fuzzyLocation,
      areaMoved: approximateAreaMovedAt !== null,
    })
  );
}

const [ana, ben, cal, dee, eve, org] = [
  {
    name: "Ana",
    address: "456 Oak Ave, Testville",
    formattedAddress: "456 Oak Avenue, Testville",
    lat: 40.71,
    lng: -74.01,
    fuzzyLocation: true,
  },
  {
    name: "Ben",
    address: "1 Nowhere Ln, Testville",
    formattedAddress: "1 Nowhere Lane, Testville",
    lat: 40.72,
    lng: -74.02,
    fuzzyLocation: true,
  },
  {
    name: "Cal",
    address: "12 Elm St, Testville",
    formattedAddress: "12 Elm Street, Testville",
    lat: 40.73,
    lng: -74.03,
    fuzzyLocation: false,
  },
  {
    name: "Dee",
    address: "2 Denied Rd, Testville",
    formattedAddress: "2 Denied Road, Testville",
    lat: 40.74,
    lng: -74.04,
    fuzzyLocation: true,
  },
  {
    name: "Eve",
    address: "789 Pine Rd, Testville",
    formattedAddress: "789 Pine Road, Testville",
    lat: 40.75,
    lng: -74.05,
    fuzzyLocation: true,
  },
  { name: "Org", address: null, formattedAddress: null, lat: null, lng: null, fuzzyLocation: true },
] as const;
const seededRows = [ana, ben, cal, dee, eve, org];
const anaArea = { lat: 40.7111034, lng: -74.0153564 };
const eveArea = { lat: 40.7366183, lng: -74.0003114 };
const addressRemoved = { address: null, formattedAddress: null };
const unmoved = (row: object) => ({ ...row, areaMoved: false });
const moved = (row: object, area: object) => ({ ...row, ...area, areaMoved: true });

describe("moveApproximateAreas", () => {
  let eventId: string;

  const run = (options: Partial<MoveOptions> = {}) =>
    moveApproximateAreas(prisma, {
      write: true,
      eventId,
      clearUnresolved: false,
      forgetAddresses: false,
      secret: SECRET,
      ...options,
    });

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

  it("counts on a dry run from the geocode cache only and changes nothing, whatever the flags", async () => {
    const counts = await run({ write: false, clearUnresolved: true, forgetAddresses: true });

    expect({
      counts,
      rows: await rows(eventId),
      googleCalls,
      cacheKeys: await testvilleKeys(),
    }).toEqual({
      counts: { ...NO_COUNTS, wouldMove: 1, notCached: 3 },
      rows: seededRows.map(unmoved),
      googleCalls: [],
      cacheKeys: ["geocode:456 oak ave, testville", "geocode:456 oak avenue, testville"],
    });
  });

  it("moves approximate participants with an address and leaves everyone else alone", async () => {
    const counts = await run();

    expect({ counts, rows: await rows(eventId), googleCalls: googleCalls.sort() }).toEqual({
      counts: { ...NO_COUNTS, moved: 2, notFound: 1, lookupFailed: 1 },
      rows: [
        moved(ana, anaArea),
        unmoved(ben),
        unmoved(cal),
        unmoved(dee),
        moved(eve, eveArea),
        unmoved(org),
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

    await run();
    await run({ eventId: otherEventId });

    expect([(await rows(eventId))[0], ...(await rows(otherEventId))]).toEqual([
      moved(ana, anaArea),
      {
        name: "Zed",
        address: "456 Oak Avenue, Testville",
        formattedAddress: null,
        ...anaArea,
        fuzzyLocation: true,
        areaMoved: true,
      },
    ]);
  });

  it("skips participants moved by an earlier run, also after the geocode cache changes", async () => {
    await run();
    const afterFirstRun = await rows(eventId);
    await redis.set(
      "geocode:456 oak ave, testville",
      JSON.stringify({ lat: 40.8, lng: -73.9, formattedAddress: "456 Oak Avenue, Testville" })
    );
    await redis.set(
      "geocode:789 pine rd, testville",
      JSON.stringify({ lat: 40.8, lng: -73.9, formattedAddress: "789 Pine Road, Testville" })
    );
    googleCalls = [];

    const secondCounts = await run();
    const secondRunGoogleCalls = googleCalls.sort();
    const dryRunCounts = await run({ write: false });

    expect({
      afterFirstRun,
      secondCounts,
      secondRunGoogleCalls,
      dryRunCounts,
      afterSecondRun: await rows(eventId),
    }).toEqual({
      afterFirstRun: [
        moved(ana, anaArea),
        unmoved(ben),
        unmoved(cal),
        unmoved(dee),
        moved(eve, eveArea),
        unmoved(org),
      ],
      secondCounts: { ...NO_COUNTS, alreadyMoved: 2, notFound: 1, lookupFailed: 1 },
      secondRunGoogleCalls: ["1 Nowhere Ln, Testville", "2 Denied Rd, Testville"],
      dryRunCounts: { ...NO_COUNTS, alreadyMoved: 2, notCached: 2 },
      afterSecondRun: afterFirstRun,
    });
  });

  it("leaves a participant alone that another run moved first", async () => {
    beforeGoogleAnswers = async (address) => {
      if (address === "789 Pine Rd, Testville") {
        await prisma.participant.updateMany({
          where: { eventId, name: "Eve" },
          data: { approximateAreaMovedAt: new Date() },
        });
      }
    };

    const counts = await run();

    expect({ counts, eve: (await rows(eventId))[4] }).toEqual({
      counts: { ...NO_COUNTS, moved: 1, changedDuringRun: 1, notFound: 1, lookupFailed: 1 },
      eve: { ...eve, areaMoved: true },
    });
  });

  it.each([false, true])(
    "leaves a participant alone whose address changes during the run (forgetAddresses %s)",
    async (forgetAddresses) => {
      beforeGoogleAnswers = async (address) => {
        if (address === "789 Pine Rd, Testville") {
          await prisma.participant.updateMany({
            where: { eventId, name: "Eve" },
            data: { address: "12 New St, Testville" },
          });
        }
      };

      const counts = await run({ forgetAddresses });

      expect({ counts, eve: (await rows(eventId))[4] }).toEqual({
        counts: {
          ...NO_COUNTS,
          [forgetAddresses ? "movedAddressRemoved" : "moved"]: 1,
          changedDuringRun: 1,
          notFound: 1,
          lookupFailed: 1,
        },
        eve: { ...unmoved(eve), address: "12 New St, Testville" },
      });
    }
  );

  it("clears the location only where the address is not found, and keeps that participant hidden", async () => {
    const counts = await run({ clearUnresolved: true });
    const benRow = await prisma.participant.findFirstOrThrow({ where: { eventId, name: "Ben" } });

    expect({ counts, rows: await rows(eventId) }).toEqual({
      counts: { ...NO_COUNTS, moved: 2, cleared: 1, lookupFailed: 1 },
      rows: [
        moved(ana, anaArea),
        { ...unmoved(ben), lat: null, lng: null },
        unmoved(cal),
        unmoved(dee),
        moved(eve, eveArea),
        unmoved(org),
      ],
    });
    expect(toParticipantResponse(benRow)).toEqual({
      id: benRow.id,
      name: "Ben",
      address: null,
      location: null,
      color: "c1",
      fuzzyLocation: true,
      isOrganizer: false,
    });
  });

  it("removes the stored address only where it moved the participant", async () => {
    const counts = await run({ clearUnresolved: true, forgetAddresses: true });

    expect({ counts, rows: await rows(eventId) }).toEqual({
      counts: { ...NO_COUNTS, movedAddressRemoved: 2, cleared: 1, lookupFailed: 1 },
      rows: [
        { ...moved(ana, anaArea), ...addressRemoved },
        { ...unmoved(ben), lat: null, lng: null },
        unmoved(cal),
        unmoved(dee),
        { ...moved(eve, eveArea), ...addressRemoved },
        unmoved(org),
      ],
    });
  });

  it("no longer selects a participant whose stored address it removed", async () => {
    await run({ forgetAddresses: true });
    const afterFirstRun = await rows(eventId);

    const secondCounts = await run({ forgetAddresses: true });

    expect({ afterFirstRun, secondCounts, afterSecondRun: await rows(eventId) }).toEqual({
      afterFirstRun: [
        { ...moved(ana, anaArea), ...addressRemoved },
        unmoved(ben),
        unmoved(cal),
        unmoved(dee),
        { ...moved(eve, eveArea), ...addressRemoved },
        unmoved(org),
      ],
      secondCounts: { ...NO_COUNTS, notFound: 1, lookupFailed: 1 },
      afterSecondRun: afterFirstRun,
    });
  });
});
