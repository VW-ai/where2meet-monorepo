import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeApp } from "../src/app.js";
import { loadConfig, type AppConfig } from "../src/runtime/config.js";
import { createProviderCache } from "../src/runtime/cache.js";
import { importData } from "../scripts/import-data.js";
import { createTestDatabase, type TestDatabase } from "./support/database.js";
import { googlePlace, googleRoute, startPlacesProvider } from "./support/places.js";
import {
  fixture,
  eventId,
  guestId,
  guestToken,
  participantId,
  participantToken,
  sessionToken,
  hashToken,
} from "./support/fixture.js";

const apiKey = "synthetic-provider-key";
const authorization = (token = participantToken) => ({ authorization: `Bearer ${token}` });
const searchInput = { center: { lat: 33, lng: -117 }, searchRadius: 1200, query: "coffee" };
const routePath = `/api/events/${eventId}/venues/fixture_place/directions`;
let database: TestDatabase;
let provider: Awaited<ReturnType<typeof startPlacesProvider>>;
let app: FastifyInstance;
let redis: Redis;
let redisUrl: string;
let origin: string;
const cleanups: (() => Promise<void>)[] = [];

async function startApp(overrides: Partial<AppConfig> = {}) {
  const instance = await makeApp({
    databaseUrl: database.databaseUrl,
    redisUrl,
    environment: "test",
    port: 0,
    logLevel: "silent",
    googleMapsApiKey: apiKey,
    placesEndpoint: provider.endpoint,
    directionsEndpoint: provider.directionsEndpoint,
    redisTimeoutMs: 200,
    placesTimeoutMs: 1000,
    searchTimeoutMs: 1500,
    routeTimeoutMs: 1000,
    photoTimeoutMs: 1500,
    ...overrides,
  });
  const address = await instance.listen({ host: "127.0.0.1", port: 0 });
  return { app: instance, address };
}

beforeAll(async () => {
  database = await createTestDatabase();
  cleanups.push(() => database.close());
  provider = await startPlacesProvider();
  cleanups.push(() => provider.close());
  const configured = process.env.REDIS_URL;
  if (!configured) throw new Error("REDIS_URL is required");
  const url = new URL(configured);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Tests require local Redis");
  url.pathname = "/15";
  redisUrl = url.toString();
  redis = new Redis(redisUrl);
  cleanups.push(async () => {
    await redis.quit();
  });
  if ((await redis.dbsize()) !== 0)
    throw new Error("M3 tests require an empty dedicated Redis database 15");
  const started = await startApp();
  app = started.app;
  origin = started.address;
  cleanups.push(() => app.close());
});

beforeEach(async () => {
  provider.reset();
  await database.reset();
  await importData(database.database, fixture());
});
afterEach(async () => {
  const keys = await redis.keys("m3:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

const search = (payload: unknown = searchInput) =>
  app.inject({
    method: "POST",
    url: "/api/venues/search",
    payload: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
const directions = (query = "", token = participantToken) =>
  app.inject({ url: `${routePath}${query}`, headers: authorization(token) });
const requests = (part: string) => provider.requests.filter((url) => url.pathname.endsWith(part));

describe("Places HTTP and trusted summaries", () => {
  it("returns complete search/details shapes, keeps false/zero metadata, and awaits the summary refresh", async () => {
    provider.respondWith((url) =>
      url.pathname.endsWith("details/json")
        ? Promise.resolve({
            status: 200,
            body: {
              status: "OK",
              result: googlePlace("fixture_place", {
                rating: 0,
                user_ratings_total: 0,
                price_level: 0,
              }),
            },
          })
        : provider.defaultResponse(url)
    );
    const found = await search();
    expect(found.statusCode).toBe(200);
    expect(found.json<unknown>()).toEqual({
      venues: [
        {
          id: "fixture_place",
          name: "Provider cafe",
          address: "Provider address",
          location: { lat: 33.25, lng: -117.75 },
          types: ["cafe"],
          rating: 4.5,
          userRatingsTotal: 123,
          priceLevel: 2,
          openNow: false,
          photoUrl: `${origin}/api/venues/fixture_place/photo`,
        },
      ],
      totalResults: 1,
      searchCenter: searchInput.center,
    });
    expect(
      (await database.database.venue.findUniqueOrThrow({ where: { id: "fixture_place" } })).name
    ).toBe("Existing cafe");
    const details = await app.inject("/api/venues/fixture_place");
    expect(details.statusCode).toBe(200);
    expect(details.json<unknown>()).toEqual({
      id: "fixture_place",
      name: "Provider cafe",
      address: "Provider address",
      location: { lat: 33.25, lng: -117.75 },
      types: ["cafe"],
      rating: 0,
      userRatingsTotal: 0,
      priceLevel: 0,
      openNow: false,
      photoUrl: `${origin}/api/venues/fixture_place/photo`,
      formattedPhoneNumber: "555-0100",
      website: "https://example.test/cafe",
      openingHours: ["Monday: 9 AM - 5 PM"],
    });
    const stored = await database.database.venue.findUniqueOrThrow({
      where: { id: "fixture_place" },
    });
    expect(stored).toMatchObject({
      name: "Provider cafe",
      photoUrl: "/api/venues/fixture_place/photo",
      priceLevel: 0,
    });
    expect(stored.lat.toNumber()).toBe(33.25);
    expect(details.body).not.toContain(apiKey);
    expect(details.body).not.toContain("trusted-photo-reference");
  });

  it("merges query before categories with first-wins deduplication and rating ordering", async () => {
    provider.respondWith((url) =>
      Promise.resolve({
        status: 200,
        body: {
          status: "OK",
          results: url.searchParams.has("query")
            ? [
                googlePlace("same", { name: "Text winner", rating: 2 }),
                googlePlace("unknown", { rating: undefined }),
              ]
            : [
                googlePlace("same", { name: "Category loser", rating: 5 }),
                googlePlace("best", { rating: 4.8 }),
              ],
        },
      })
    );
    const result = await search({
      ...searchInput,
      searchRadius: 1200.4,
      categories: ["cafe", "cafe", "shopping", "things_to_do"],
    });
    expect(result.statusCode).toBe(200);
    expect(
      result
        .json<{ venues: { id: string; name: string }[] }>()
        .venues.map((place) => [place.id, place.name])
    ).toEqual([
      ["best", "Provider cafe"],
      ["same", "Text winner"],
      ["unknown", "Provider cafe"],
    ]);
    expect(requests("nearbysearch/json").map((url) => url.searchParams.get("type"))).toEqual([
      "cafe",
      "shopping_mall",
      "tourist_attraction",
    ]);
    expect(provider.requests.every((url) => url.searchParams.get("radius") === "1200")).toBe(true);
    expect(
      (await search({ center: searchInput.center, searchRadius: 100, categories: ["park"] }))
        .statusCode
    ).toBe(200);
  });

  it.each([
    {},
    { ...searchInput, center: { lat: 91, lng: 0 } },
    { ...searchInput, searchRadius: 99 },
    { ...searchInput, searchRadius: 50001 },
    { ...searchInput, query: "" },
    { ...searchInput, query: "x".repeat(101) },
    { ...searchInput, categories: [] },
    { ...searchInput, categories: ["invalid"] },
  ])("rejects invalid search input before provider work %j", async (payload) => {
    const result = await search(payload);
    expect(result.statusCode).toBe(400);
    expect(result.json<unknown>()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid request" },
    });
    expect(provider.requests).toHaveLength(0);
  });

  it("distinguishes valid empty search from malformed data and provider failure", async () => {
    provider.respondWith(() =>
      Promise.resolve({ status: 200, body: { status: "ZERO_RESULTS", results: [] } })
    );
    expect((await search()).json<unknown>()).toEqual({
      venues: [],
      totalResults: 0,
      searchCenter: searchInput.center,
    });
    for (const body of [
      { status: "ZERO_RESULTS" },
      {
        status: "OK",
        results: [googlePlace("bad", { geometry: { location: { lat: 99, lng: 1 } } })],
      },
      { status: "REQUEST_DENIED", error_message: apiKey },
    ]) {
      provider.respondWith(() => Promise.resolve({ status: 200, body }));
      const result = await search({ ...searchInput, query: randomUUID() });
      expect(result.statusCode).toBe(502);
      expect(result.body).not.toContain(apiKey);
    }
  });

  it("fails an entire union search when one category fails", async () => {
    provider.respondWith((url) =>
      url.searchParams.has("type")
        ? Promise.resolve({ status: 200, body: { status: "REQUEST_DENIED" } })
        : provider.defaultResponse(url)
    );
    expect((await search({ ...searchInput, categories: ["cafe"] })).statusCode).toBe(502);
  });

  it.each([
    { status: "NOT_FOUND" },
    { status: "OK" },
    { status: "OK", result: googlePlace("wrong-id") },
  ])("does not accept absent or mismatched details %j", async (body) => {
    provider.respondWith(() => Promise.resolve({ status: 200, body }));
    expect((await app.inject("/api/venues/fixture_place")).statusCode).toBe(502);
    expect(
      (await database.database.venue.findUniqueOrThrow({ where: { id: "fixture_place" } })).name
    ).toBe("Existing cafe");
  });

  it("does not return successful details when the summary write fails", async () => {
    await database.database.$executeRawUnsafe(
      `ALTER TABLE venue ADD CONSTRAINT m3_reject_provider CHECK (name <> 'Provider cafe')`
    );
    try {
      expect((await app.inject("/api/venues/fixture_place")).statusCode).toBe(500);
    } finally {
      await database.database.$executeRawUnsafe(
        "ALTER TABLE venue DROP CONSTRAINT m3_reject_provider"
      );
    }
    expect(
      (await database.database.venue.findUniqueOrThrow({ where: { id: "fixture_place" } })).name
    ).toBe("Existing cafe");
  });
});

describe("Meeting directions", () => {
  it("keeps exact participant association for shared coordinates and out-of-order completion", async () => {
    const thirdId = randomUUID();
    await database.database.participant.updateMany({ data: { lat: 0, lng: 0 } });
    await database.database.participant.create({
      data: { id: thirdId, eventId, name: "Third", color: "mint", lat: 1, lng: 1 },
    });
    const completed: string[] = [];
    provider.respondWith(async (url) => {
      if (!url.pathname.endsWith("directions/json")) return provider.defaultResponse(url);
      const point = url.searchParams.get("origin") ?? "";
      await delay(point === "0,0" ? 40 : 1);
      completed.push(point);
      return { status: 200, body: point === "0,0" ? googleRoute(100, 60) : googleRoute(200, 120) };
    });
    const result = await directions();
    expect(result.statusCode).toBe(200);
    const data = result.json<{
      routes: { participantId: string; distance: { value: number }; duration: { value: number } }[];
      outcomes: { participantId: string; status: string }[];
    }>();
    expect(completed[0]).toBe("1,1");
    expect(
      data.routes.map((entry) => [entry.participantId, entry.distance.value, entry.duration.value])
    ).toEqual([
      [participantId, 100, 60],
      [guestId, 100, 60],
      [thirdId, 200, 120],
    ]);
    expect(data.outcomes).toEqual([
      { participantId, status: "found" },
      { participantId: guestId, status: "found" },
      { participantId: thirdId, status: "found" },
    ]);
  });

  it.each([
    { meters: 1, seconds: 1, polyline: "?" },
    { meters: -1, seconds: 1, polyline: "??" },
    { meters: 1, seconds: "60", polyline: "??" },
    { meters: 1, seconds: 1, polyline: "~~~~~~~" },
  ])(
    "reports malformed provider routes as unavailable %j",
    async ({ meters, seconds, polyline }) => {
      provider.respondWith((url) =>
        url.pathname.endsWith("directions/json")
          ? Promise.resolve({
              status: 200,
              body: {
                status: "OK",
                routes: [
                  {
                    legs: [{ distance: { value: meters }, duration: { value: seconds } }],
                    overview_polyline: { points: polyline },
                  },
                ],
              },
            })
          : provider.defaultResponse(url)
      );
      const result = await directions(`?participantId=${guestId}`);
      expect(result.statusCode).toBe(200);
      expect(result.json<unknown>()).toEqual({
        venueId: "fixture_place",
        travelMode: "driving",
        routes: [],
        outcomes: [{ participantId: guestId, status: "unavailable" }],
      });
      expect(requests("directions/json")).toHaveLength(1);
    }
  );
  it("uses the fuzzy stored origin and trusted destination instead of imported coordinates", async () => {
    await database.database.venue.update({
      where: { id: "fixture_place" },
      data: { lat: 1, lng: 2 },
    });
    const result = await directions();
    expect(result.statusCode).toBe(200);
    expect(result.json<unknown>()).toEqual({
      venueId: "fixture_place",
      travelMode: "driving",
      routes: [
        {
          participantId: guestId,
          distance: { value: 1609.344, text: "1 mi" },
          duration: { value: 600, text: "10 mins" },
          polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        },
        { participantId, distance: null, duration: null, polyline: null },
      ],
      outcomes: [
        { participantId, status: "no-location" },
        { participantId: guestId, status: "found" },
      ],
    });
    expect(requests("directions/json").map((url) => Object.fromEntries(url.searchParams))).toEqual([
      {
        origin: "32.1234567,-117.1234567",
        destination: "33.25,-117.75",
        mode: "driving",
        key: apiKey,
      },
    ]);
    expect(provider.requests.some((url) => url.href.includes("Example"))).toBe(false);
    expect(
      (
        await database.database.venue.findUniqueOrThrow({ where: { id: "fixture_place" } })
      ).lat.toNumber()
    ).toBe(1);
  });

  it("allows any meeting participant to select another, supports zero and all modes", async () => {
    await database.database.participant.update({
      where: { id: participantId },
      data: { lat: 0, lng: 0 },
    });
    provider.respondWith((url) =>
      url.pathname.endsWith("directions/json")
        ? Promise.resolve({ status: 200, body: googleRoute(0, 0) })
        : provider.defaultResponse(url)
    );
    for (const mode of ["driving", "walking", "transit", "bicycling"]) {
      const result = await directions(
        `?travelMode=${mode}&participantId=${participantId}`,
        guestToken
      );
      expect(result.statusCode).toBe(200);
      expect(result.json<unknown>()).toMatchObject({
        travelMode: mode,
        routes: [
          {
            participantId,
            distance: { value: 0, text: "0 ft" },
            duration: { value: 0, text: "1 min" },
          },
        ],
        outcomes: [{ participantId, status: "found" }],
      });
    }
    expect(
      requests("directions/json").every((url) => url.searchParams.get("origin") === "0,0")
    ).toBe(true);
  });

  it("rejects credentials and unknown participants before quota is spent", async () => {
    const foreignEvent = "evt_1700000000001_0123456789abcdef";
    const foreignToken = `pt_${"e".repeat(64)}`;
    await database.database.event.create({ data: { id: foreignEvent, title: "Other" } });
    await database.database.participant.create({
      data: {
        eventId: foreignEvent,
        name: "Other",
        color: "mint",
        tokenHash: hashToken(foreignToken),
      },
    });
    for (const result of [
      await app.inject(routePath),
      await app.inject({ url: routePath, headers: { cookie: `session_token=${sessionToken}` } }),
    ])
      expect(result.statusCode).toBe(401);
    expect((await directions("", foreignToken)).statusCode).toBe(403);
    expect((await directions("", "invalid")).statusCode).toBe(403);
    expect((await directions(`?participantId=${randomUUID()}`)).statusCode).toBe(404);
    expect((await directions("?participantId=invalid")).statusCode).toBe(400);
    expect((await directions("?travelMode=flying")).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          url: routePath.replace(eventId, "evt_1700000000002_0123456789abcdef"),
          headers: authorization(),
        })
      ).statusCode
    ).toBe(404);
    expect(provider.requests).toHaveLength(0);
  });

  it("reports found, no-route, unavailable, and no-location participants without unsafe null failures", async () => {
    const noRouteId = randomUUID(),
      unavailableId = randomUUID();
    await database.database.participant.createMany({
      data: [
        { id: noRouteId, eventId, name: "No route", color: "mint", lat: 1, lng: 1 },
        { id: unavailableId, eventId, name: "Unavailable", color: "mint", lat: 2, lng: 2 },
      ],
    });
    provider.respondWith((url) => {
      if (url.searchParams.get("origin") === "1,1")
        return Promise.resolve({ status: 200, body: { status: "ZERO_RESULTS", routes: [] } });
      if (url.searchParams.get("origin") === "2,2")
        return Promise.resolve({ status: 200, body: { status: "REQUEST_DENIED" } });
      return provider.defaultResponse(url);
    });
    const result = await directions();
    expect(result.statusCode).toBe(200);
    const data = result.json<{
      routes: { participantId: string }[];
      outcomes: { participantId: string; status: string }[];
    }>();
    expect(data.routes.map((row) => row.participantId)).toEqual([guestId, participantId]);
    expect(data.outcomes).toEqual(
      expect.arrayContaining([
        { participantId, status: "no-location" },
        { participantId: guestId, status: "found" },
        { participantId: noRouteId, status: "no-route" },
        { participantId: unavailableId, status: "unavailable" },
      ])
    );
    expect(data.outcomes).toHaveLength(4);
  });

  it("retains explicit outcomes for an all-failed batch and all-unlocated meeting", async () => {
    provider.respondWith((url) =>
      url.pathname.endsWith("directions/json")
        ? Promise.resolve({ status: 200, text: "not json" })
        : provider.defaultResponse(url)
    );
    const failed = await directions(`?participantId=${guestId}`);
    expect(failed.statusCode).toBe(200);
    expect(failed.json<unknown>()).toEqual({
      venueId: "fixture_place",
      travelMode: "driving",
      routes: [],
      outcomes: [{ participantId: guestId, status: "unavailable" }],
    });
    expect(requests("directions/json")).toHaveLength(1);
    await database.database.participant.update({
      where: { id: guestId },
      data: { lat: null, lng: null },
    });
    const result = await directions();
    expect(result.json<unknown>()).toMatchObject({
      routes: [
        { participantId, distance: null, duration: null, polyline: null },
        { participantId: guestId, distance: null, duration: null, polyline: null },
      ],
      outcomes: [
        { participantId, status: "no-location" },
        { participantId: guestId, status: "no-location" },
      ],
    });
    expect(requests("directions/json")).toHaveLength(1);
  });

  it("preserves missing-destination failure even when no participant has a location", async () => {
    await database.database.participant.updateMany({ data: { lat: null, lng: null } });
    provider.respondWith(() => Promise.resolve({ status: 200, body: { status: "NOT_FOUND" } }));
    expect((await directions()).statusCode).toBe(400);
    expect(requests("details/json")).toHaveLength(1);
  });

  it("does not keep a transaction open across provider work and uses one authorized snapshot", async () => {
    provider.respondWith(async (url) => {
      if (url.pathname.endsWith("details/json"))
        await database.database.participant.update({
          where: { id: guestId },
          data: { lat: 9, lng: 9, tokenHash: null },
        });
      return provider.defaultResponse(url);
    });
    expect((await directions("", guestToken)).statusCode).toBe(200);
    expect(requests("directions/json")[0]?.searchParams.get("origin")).toBe(
      "32.1234567,-117.1234567"
    );
    expect((await directions("", guestToken)).statusCode).toBe(403);
  });
});

describe("validated Redis cache and provider deadlines", () => {
  it("reuses validated search/details/routes, separates exact query, coordinates, radius, mode and origin", async () => {
    expect((await search()).statusCode).toBe(200);
    expect((await search()).statusCode).toBe(200);
    expect(requests("textsearch/json")).toHaveLength(1);
    for (const patch of [
      { query: "Coffee" },
      { query: " coffee " },
      { center: { lat: 33.00001, lng: -117 } },
      { searchRadius: 1201 },
    ])
      expect((await search({ ...searchInput, ...patch })).statusCode).toBe(200);
    expect(requests("textsearch/json")).toHaveLength(5);
    await app.inject("/api/venues/fixture_place");
    await directions();
    await directions();
    expect(requests("details/json")).toHaveLength(1);
    expect(requests("directions/json")).toHaveLength(1);
    await directions("?travelMode=walking");
    await database.database.participant.update({
      where: { id: guestId },
      data: { lat: 32.1234568 },
    });
    await directions();
    expect(requests("directions/json")).toHaveLength(3);
    const keys = await redis.keys("m3:*");
    expect(keys.every((key) => !key.includes(apiKey) && !key.includes(guestId))).toBe(true);
  });

  it("treats invalid JSON, corrupt normalized values, mismatched IDs and expired entries as misses", async () => {
    await app.inject("/api/venues/fixture_place");
    const [key] = await redis.keys("m3:places:details:v1:*");
    if (!key) throw new Error("Expected details cache key");
    const initial = await redis.get(key);
    if (!initial) throw new Error("Expected details cache entry");
    for (const corrupted of [
      "not json",
      JSON.stringify({ version: 1, value: { id: "fixture_place" } }),
      initial.replace('"fixture_place"', '"wrong_place"'),
    ]) {
      await redis.set(key, corrupted);
      expect((await app.inject("/api/venues/fixture_place")).statusCode).toBe(200);
    }
    expect(requests("details/json")).toHaveLength(4);
    await redis.pexpire(key, 1);
    await delay(10);
    expect((await app.inject("/api/venues/fixture_place")).statusCode).toBe(200);
    expect(requests("details/json")).toHaveLength(5);
    await redis.set(
      "places:details:fixture_place",
      initial.replace('"Provider cafe"', '"Legacy poison"')
    );
    try {
      await redis.del(key);
      expect((await app.inject("/api/venues/fixture_place")).body).not.toContain("Legacy poison");
    } finally {
      await redis.del("places:details:fixture_place");
    }
  });

  it("rejects corrupt route cache instead of constructing success with missing metrics", async () => {
    await directions();
    const [key] = await redis.keys("m3:routing:v1:*");
    if (!key) throw new Error("Expected route cache key");
    await redis.set(
      key,
      JSON.stringify({ version: 1, value: { meters: 5, seconds: 5, polyline: "not a polyline" } })
    );
    provider.respondWith((url) =>
      url.pathname.endsWith("directions/json")
        ? Promise.resolve({ status: 200, body: { status: "ZERO_RESULTS", routes: [] } })
        : provider.defaultResponse(url)
    );
    expect((await directions(`?participantId=${guestId}`)).json<unknown>()).toMatchObject({
      routes: [],
      outcomes: [{ participantId: guestId, status: "no-route" }],
    });
    expect(requests("directions/json")).toHaveLength(2);
  });

  it("retries transient transport and HTTP/provider failures at most three times", async () => {
    let attempt = 0;
    provider.respondWith((url) => {
      attempt++;
      if (attempt === 1) return Promise.resolve({ kind: "disconnect" });
      if (attempt === 2) return Promise.resolve({ status: 429, body: {} });
      return provider.defaultResponse(url);
    });
    expect((await search()).statusCode).toBe(200);
    expect(attempt).toBe(3);
    provider.respondWith(() =>
      Promise.resolve({ status: 200, body: { status: "OVER_QUERY_LIMIT" } })
    );
    const before = provider.requests.length;
    expect((await app.inject("/api/venues/uncached")).statusCode).toBe(502);
    expect(provider.requests.length - before).toBe(3);
    provider.respondWith(() => Promise.resolve({ status: 200, text: "invalid json" }));
    const invalidBefore = provider.requests.length;
    expect((await app.inject("/api/venues/invalid")).statusCode).toBe(502);
    expect(provider.requests.length - invalidBefore).toBe(1);
  });

  it("bounds search fanout and cancels every unfinished route at a shared deadline", async () => {
    const limited = await startApp({
      placesTimeoutMs: 200,
      searchTimeoutMs: 250,
      routeTimeoutMs: 200,
    });
    try {
      let active = 0,
        maximum = 0;
      provider.respondWith(async (url) => {
        if (url.pathname.endsWith("details/json")) return provider.defaultResponse(url);
        active++;
        maximum = Math.max(maximum, active);
        await delay(350);
        active--;
        return provider.defaultResponse(url);
      });
      const start = performance.now();
      const result = await limited.app.inject({
        method: "POST",
        url: "/api/venues/search",
        payload: { ...searchInput, categories: ["cafe", "park", "museum"] },
      });
      expect(result.statusCode).toBe(502);
      expect(performance.now() - start).toBeLessThan(900);
      expect(maximum).toBeLessThanOrEqual(2);
      await delay(400);
      active = 0;
      maximum = 0;
      await database.database.participant.createMany({
        data: Array.from({ length: 6 }, (_, index) => ({
          eventId,
          name: `Person ${String(index)}`,
          color: "mint",
          lat: index,
          lng: index,
        })),
      });
      const routeStart = performance.now();
      const routed = await limited.app.inject({ url: routePath, headers: authorization() });
      expect(routed.statusCode).toBe(200);
      const outcomes = routed.json<{ outcomes: { status: string }[] }>().outcomes;
      expect(outcomes.filter((entry) => entry.status === "unavailable")).toHaveLength(7);
      expect(outcomes).toHaveLength(8);
      expect(maximum).toBeLessThanOrEqual(4);
      expect(performance.now() - routeStart).toBeLessThan(900);
      await delay(400);
    } finally {
      await limited.app.close();
    }
  });

  it("serves provider results when Redis is unavailable and bounds a stalled cache operation", async () => {
    const dead = createServer();
    await new Promise<void>((resolve) => dead.listen(0, "127.0.0.1", resolve));
    const address = dead.address();
    if (!address || typeof address === "string") throw new Error("Missing socket address");
    await new Promise<void>((resolve) =>
      dead.close(() => {
        resolve();
      })
    );
    const offline = await startApp({ redisUrl: `redis://127.0.0.1:${String(address.port)}` });
    try {
      expect(
        (
          await offline.app.inject({
            method: "POST",
            url: "/api/venues/search",
            payload: searchInput,
          })
        ).statusCode
      ).toBe(200);
    } finally {
      await offline.app.close();
    }
    const cache = createProviderCache(redisUrl);
    try {
      await delay(50);
      await redis.call("CLIENT", "PAUSE", "700", "ALL");
      const start = performance.now();
      expect(await cache.read("m3:stalled:test", AbortSignal.timeout(2000))).toBeNull();
      expect(performance.now() - start).toBeLessThan(650);
      await delay(250);
    } finally {
      cache.close();
    }
  });
});

describe("key-free venue photos", () => {
  it("does not turn an imported empty photo string into an image request", async () => {
    await database.database.venue.update({
      where: { id: "fixture_place" },
      data: { photoUrl: "" },
    });
    const result = await app.inject(`/api/events/${eventId}/votes`);
    expect(result.statusCode).toBe(200);
    expect(result.json<{ venues: { photoUrl: string | null }[] }>().venues[0]?.photoUrl).toBeNull();
    expect(provider.requests).toHaveLength(0);
  });

  it("accepts only hostname-shaped Railway fallback configuration", () => {
    const base: Partial<AppConfig> = {
      databaseUrl: database.databaseUrl,
      environment: "production",
      corsOrigins: ["https://frontend.example.test"],
    };
    vi.stubEnv("PUBLIC_API_ORIGIN", undefined);
    try {
      vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "service.example.test");
      expect(loadConfig(base).publicApiOrigin).toBe("https://service.example.test");
      for (const domain of [
        "user@service.example.test",
        "service.example.test/path",
        "service.example.test:443",
        "https://service.example.test",
        "0.0.0.0",
      ]) {
        vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", domain);
        expect(() => loadConfig(base)).toThrow();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("uses the actual loopback port, ignores Host, redirects without forwarding the key, and sanitizes imported URLs", async () => {
    await database.database.venue.update({
      where: { id: "fixture_place" },
      data: {
        photoUrl: `https://maps.googleapis.com/maps/api/place/photo?key=${apiKey}&photoreference=untrusted`,
      },
    });
    const votes = await app.inject({
      url: `/api/events/${eventId}/votes`,
      headers: { host: "attacker.test" },
    });
    expect(votes.statusCode).toBe(200);
    expect(votes.json<{ venues: { photoUrl: string }[] }>().venues[0]?.photoUrl).toBe(
      `${origin}/api/venues/fixture_place/photo`
    );
    expect(votes.body).not.toContain(apiKey);
    const photo = await app.inject(
      "/api/venues/fixture_place/photo?width=9000&url=https://attacker.test"
    );
    expect(photo.statusCode).toBe(302);
    expect(photo.headers.location).toBe("https://lh3.googleusercontent.com/safe-image");
    expect(photo.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(photo.headers)).not.toContain(apiKey);
    expect(requests("photo").map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { photoreference: "trusted-photo-reference", maxwidth: "400", key: apiKey },
    ]);
  });

  it("returns 404 only for a validated missing photo and 502 for upstream failure", async () => {
    provider.respondWith(() =>
      Promise.resolve({
        status: 200,
        body: { status: "OK", result: googlePlace("no-photo", { photos: undefined }) },
      })
    );
    const missing = await app.inject("/api/venues/no-photo/photo");
    expect(missing.statusCode).toBe(404);
    expect(missing.headers["cache-control"]).toBe("no-store");
    provider.respondWith(() =>
      Promise.resolve({ status: 200, body: { status: "REQUEST_DENIED", error_message: apiKey } })
    );
    const unavailable = await app.inject("/api/venues/unavailable/photo");
    expect(unavailable.statusCode).toBe(502);
    expect(unavailable.body).not.toContain(apiKey);
  });

  it.each([
    "http://lh3.googleusercontent.com/image",
    "https://evil.test/image",
    "https://lh3.googleusercontent.com.evil.test/image",
    "https://user@lh3.googleusercontent.com/image",
    "https://lh3.googleusercontent.com:444/image",
    "https://lh3.googleusercontent.com/image?key=secret",
    "https://lh3.googleusercontent.com/image#fragment",
    `https://lh3.googleusercontent.com/${apiKey}`,
    `https://lh3.googleusercontent.com/${encodeURIComponent(apiKey.replace(/./g, (character) => `%${character.charCodeAt(0).toString(16)}`))}`,
  ])("rejects unsafe redirect %s", async (location) => {
    provider.respondWith((url) =>
      url.pathname.endsWith("photo")
        ? Promise.resolve({ status: 302, location })
        : provider.defaultResponse(url)
    );
    const result = await app.inject("/api/venues/fixture_place/photo");
    expect(result.statusCode).toBe(502);
    expect(result.headers.location).toBeUndefined();
    expect(result.body).not.toContain(apiKey);
  });

  it("validates explicit origins and does not derive production URLs from incoming requests", () => {
    const base = {
      databaseUrl: database.databaseUrl,
      environment: "production" as const,
      corsOrigins: ["https://frontend.example.test"],
    };
    expect(
      loadConfig({ ...base, publicApiOrigin: "https://api.example.test/" }).publicApiOrigin
    ).toBe("https://api.example.test");
    for (const publicApiOrigin of [
      "http://api.example.test",
      "https://0.0.0.0",
      "https://api.example.test/path",
      "https://user@api.example.test",
      "https://api.example.test?key=secret",
      "https://api.example.test#fragment",
      null,
    ])
      expect(() => loadConfig({ ...base, publicApiOrigin })).toThrow();
  });
});
