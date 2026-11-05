/**
 * Behavior tests for previewing a person before adding them.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { providerFor, type MapProviderClient } from "../src/lib/providers/index.js";
import { AddressNotFoundError } from "../src/lib/maps.js";
import type { TravelMode } from "../src/lib/directions/index.js";

const VENUE_ID = "ChIJpreview_venue";
const TOKYO = { lat: 35.68, lng: 139.76, formattedAddress: "Tokyo, Japan" };
const SECONDS: Record<TravelMode, number> = {
  driving: 600,
  walking: 2400,
  transit: 1500,
  bicycling: 900,
};

function stubProvider(withRoutes: readonly TravelMode[]) {
  const google = providerFor("google");
  vi.spyOn(google, "geocode").mockImplementation((address) =>
    address === "nowhere"
      ? Promise.reject(new AddressNotFoundError())
      : Promise.resolve(TOKYO)
  );
  return vi
    .spyOn(google, "calculateBatchRoutes")
    .mockImplementation(((participants, _venue, mode) =>
      Promise.resolve(
        withRoutes.includes(mode)
          ? participants.map((p) => ({
              participantId: p.id,
              distance: { value: 1000, text: "0.6 mi" },
              duration: { value: SECONDS[mode], text: `${String(SECONDS[mode] / 60)} mins` },
              polyline: `line_${mode}`,
            }))
          : []
      )) as MapProviderClient["calculateBatchRoutes"]);
}

describe("POST /api/events/:id/participant-preview", () => {
  let server: FastifyInstance;
  let eventId: string;
  let organizerToken: string;

  const preview = (payload: unknown, token: string | null = organizerToken) =>
    server.inject({
      method: "POST",
      url: `/api/events/${eventId}/participant-preview`,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      payload: payload as Record<string, unknown>,
    });

  const participantCount = async () =>
    (await server.inject({ method: "GET", url: `/api/events/${eventId}` })).json().participants
      .length as number;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    const created = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: "Preview", meetingTime: "2030-01-15T12:00:00Z" },
    });
    eventId = created.json().id;
    organizerToken = created.json().participantToken;
    await server.db.venue.upsert({
      where: { id: VENUE_ID },
      create: {
        id: VENUE_ID,
        name: "Spot",
        address: "1 Spot St",
        lat: 35.7,
        lng: 139.7,
        category: "cafe",
        rating: 4,
        priceLevel: 1,
        photoUrl: null,
      },
      update: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the place and a route in every mode that has one, leaving out the rest", async () => {
    stubProvider(["driving", "transit", "walking"]);

    const response = await preview({ address: "Tokyo", venueId: VENUE_ID });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.location).toEqual({ lat: TOKYO.lat, lng: TOKYO.lng });
    expect(body.formattedAddress).toBe(TOKYO.formattedAddress);
    expect(
      Object.fromEntries(
        (body.routes as { travelMode: TravelMode; duration: { value: number } }[]).map((route) => [
          route.travelMode,
          route.duration.value,
        ])
      )
    ).toEqual({ driving: 600, transit: 1500, walking: 2400 });
    expect(body.routes[0]).toEqual({
      travelMode: "driving",
      distance: { value: 1000, text: "0.6 mi" },
      duration: { value: 600, text: "10 mins" },
      polyline: "line_driving",
    });
  });

  it("returns no routes and asks for none when no venue is given", async () => {
    const batch = stubProvider(["driving"]);

    const response = await preview({ address: "Tokyo" });

    expect(response.statusCode).toBe(200);
    expect(response.json().routes).toEqual([]);
    expect(batch).not.toHaveBeenCalled();
  });

  it("saves nobody", async () => {
    stubProvider(["driving"]);
    const before = await participantCount();

    await preview({ address: "Tokyo", venueId: VENUE_ID });

    expect(await participantCount()).toBe(before);
  });

  it("is refused for someone who joined themselves", async () => {
    stubProvider(["driving"]);
    const joined = await server.inject({
      method: "POST",
      url: `/api/events/${eventId}/participants`,
      payload: { name: "Maya", address: "Tokyo" },
    });

    const response = await preview({ address: "Tokyo" }, joined.json().participantToken);

    expect(response.statusCode).toBe(403);
  });

  it("is refused with no token", async () => {
    expect((await preview({ address: "Tokyo" }, null)).statusCode).toBe(401);
  });

  it("reports an address that can't be found the way adding someone does", async () => {
    stubProvider(["driving"]);

    const response = await preview({ address: "nowhere", venueId: VENUE_ID });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("ADDRESS_NOT_FOUND");
  });

  it("rejects a body with no address", async () => {
    expect((await preview({ venueId: VENUE_ID })).statusCode).toBe(400);
  });
});
