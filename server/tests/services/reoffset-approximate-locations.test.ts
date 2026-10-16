/**
 * Integration tests for the one-off that gives approximate participants a new area.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("../../src/lib/maps.js", () => ({ geocode: vi.fn() }));

vi.mock("crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("crypto")>()),
  randomInt: vi.fn(),
}));

import { randomInt } from "crypto";
import { geocode } from "../../src/lib/maps.js";
import { prisma } from "../../src/lib/prisma.js";
import { generateEventId } from "../../src/utils/id.js";
import { reoffsetApproximateLocations } from "../../src/services/reoffset-approximate-locations.js";

const mockGeocode = vi.mocked(geocode);

const geocodeSavedAddresses = (onGeocode: (address: string) => Promise<void> = async () => {}) =>
  mockGeocode.mockImplementation(async (address) => {
    await onGeocode(address);
    if (address === "1 Nowhere Ln") throw new Error("Address not found");
    return { lat: 40.7128, lng: -74.006, formattedAddress: "456 Oak Avenue, New York, NY" };
  });

async function locations(eventId: string) {
  const participants = await prisma.participant.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    select: { name: true, lat: true, lng: true },
  });
  return participants.map(({ name, lat, lng }) => ({
    name,
    lat: lat === null ? null : Number(lat),
    lng: lng === null ? null : Number(lng),
  }));
}

describe("reoffsetApproximateLocations", () => {
  let eventId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // The lowest draw puts the new area 800 m due north
    vi.mocked(randomInt).mockImplementation((() => 0) as unknown as typeof randomInt);
    geocodeSavedAddresses();

    eventId = generateEventId();
    await prisma.event.create({
      data: {
        id: eventId,
        title: "Re-offset",
        participants: {
          create: [
            {
              name: "Ana",
              address: "456 Oak Ave",
              lat: 40.71,
              lng: -74.01,
              fuzzyLocation: true,
              color: "teal",
            },
            {
              name: "Ben",
              address: "1 Nowhere Ln",
              lat: 40.72,
              lng: -74.02,
              fuzzyLocation: true,
              color: "blue",
            },
            {
              name: "Cal",
              address: "789 Pine Rd",
              lat: 40.73,
              lng: -74.03,
              fuzzyLocation: false,
              color: "green",
            },
            { name: "Org", fuzzyLocation: true, color: "coral", isOrganizer: true },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts on a dry run and writes nothing", async () => {
    const counts = await reoffsetApproximateLocations(prisma, { write: false, eventId });

    expect(counts).toEqual({ approximate: 2, geocodeFailed: 1, editedDuringRun: 0, moved: 1 });
    expect(await locations(eventId)).toEqual([
      { name: "Ana", lat: 40.71, lng: -74.01 },
      { name: "Ben", lat: 40.72, lng: -74.02 },
      { name: "Cal", lat: 40.73, lng: -74.03 },
      { name: "Org", lat: null, lng: null },
    ]);
  });

  it("re-geocodes each saved address and moves only approximate participants it could geocode", async () => {
    const counts = await reoffsetApproximateLocations(prisma, { write: true, eventId });

    expect(counts).toEqual({ approximate: 2, geocodeFailed: 1, editedDuringRun: 0, moved: 1 });
    expect(mockGeocode.mock.calls.flat().sort()).toEqual(["1 Nowhere Ln", "456 Oak Ave"]);
    expect(await locations(eventId)).toEqual([
      { name: "Ana", lat: 40.7199865, lng: -74.006 },
      { name: "Ben", lat: 40.72, lng: -74.02 },
      { name: "Cal", lat: 40.73, lng: -74.03 },
      { name: "Org", lat: null, lng: null },
    ]);
  });

  it("leaves a participant alone whose address changes during the run", async () => {
    geocodeSavedAddresses(async (address) => {
      if (address === "456 Oak Ave") {
        await prisma.participant.updateMany({
          where: { eventId, name: "Ana" },
          data: { address: "12 New St" },
        });
      }
    });

    const counts = await reoffsetApproximateLocations(prisma, { write: true, eventId });

    expect(counts).toEqual({ approximate: 2, geocodeFailed: 1, editedDuringRun: 1, moved: 0 });
    expect(await locations(eventId)).toEqual([
      { name: "Ana", lat: 40.71, lng: -74.01 },
      { name: "Ben", lat: 40.72, lng: -74.02 },
      { name: "Cal", lat: 40.73, lng: -74.03 },
      { name: "Org", lat: null, lng: null },
    ]);
  });
});
