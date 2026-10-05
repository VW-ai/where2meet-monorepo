import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "../src/app.js";
import type { AppConfig } from "../src/runtime/config.js";
import { importData } from "../scripts/import-data.js";
import { createTestDatabase, type TestDatabase } from "./support/database.js";
import { startPlacesProvider, type ProviderReply } from "./support/places.js";
import { deferred } from "./support/geocoder.js";
import { openStream } from "./support/stream.js";
import {
  fixture,
  eventId,
  participantId,
  guestId,
  participantToken,
  guestToken,
  sessionToken,
  hashToken,
} from "./support/fixture.js";

const authorization = (token = participantToken) => ({ authorization: `Bearer ${token}` });
const poisonedVenue = {
  name: "Untrusted cafe",
  address: "Untrusted address",
  lat: 1,
  lng: 2,
  category: "untrusted",
  rating: 1,
  priceLevel: 0,
  photoUrl: "https://untrusted.test/photo",
};
const voteResponse = z.object({ success: z.literal(true), voteId: z.uuid() }).strict();
const stamp = z.object({ updatedAt: z.iso.datetime(), seq: z.number().int().nonnegative() });
let database: TestDatabase;
let provider: Awaited<ReturnType<typeof startPlacesProvider>>;
let redis: Redis;
let redisUrl: string;
let app: FastifyInstance;
let address: string;
const cleanups: (() => Promise<void>)[] = [];

async function startApp(overrides: Partial<AppConfig> = {}) {
  const instance = await makeApp({
    databaseUrl: database.databaseUrl,
    redisUrl,
    environment: "test",
    port: 0,
    logLevel: "silent",
    googleMapsApiKey: "synthetic-provider-key",
    placesEndpoint: provider.endpoint,
    placesTimeoutMs: 3000,
    redisTimeoutMs: 100,
    heartbeatIntervalMs: 1000,
    streamTimeoutMs: 10000,
    ...overrides,
  });
  const origin = await instance.listen({ host: "127.0.0.1", port: 0 });
  return { app: instance, address: origin };
}

async function clearOwnedCache() {
  const keys = [...(await redis.keys("m3:*")), ...(await redis.keys("sse:seq:evt_*"))];
  if (keys.length) await redis.del(...keys);
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
  url.pathname = "/14";
  redisUrl = url.toString();
  redis = new Redis(redisUrl);
  cleanups.push(async () => {
    await redis.quit();
  });
  if ((await redis.dbsize()) !== 0)
    throw new Error("M4 tests require an empty dedicated Redis database 14");
  cleanups.push(clearOwnedCache);
  const started = await startApp();
  app = started.app;
  address = started.address;
  cleanups.push(() => app.close());
});
beforeEach(async () => {
  provider.reset();
  await clearOwnedCache();
  await database.reset();
  await importData(database.database, fixture());
});
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

async function cast(
  venueId = "new_place",
  participant = participantId,
  token = participantToken,
  target = app
) {
  return target.inject({
    method: "POST",
    url: `/api/events/${eventId}/participants/${participant}/votes`,
    headers: authorization(token),
    payload: { venueId, venueData: poisonedVenue },
  });
}
async function remove(
  venueId = "new_place",
  participant = participantId,
  token = participantToken,
  target = app
) {
  return target.inject({
    method: "DELETE",
    url: `/api/events/${eventId}/participants/${participant}/votes/${venueId}`,
    headers: authorization(token),
  });
}
async function publish(venueId = "new_place", token = participantToken, target = app) {
  return target.inject({
    method: "POST",
    url: `/api/events/${eventId}/publish`,
    headers: authorization(token),
    payload: { venueId },
  });
}
async function reopen(token = participantToken, target = app) {
  return target.inject({
    method: "DELETE",
    url: `/api/events/${eventId}/publish`,
    headers: authorization(token),
  });
}
async function statistics() {
  const response = await app.inject(`/api/events/${eventId}/votes/statistics`);
  expect(response.statusCode).toBe(200);
  return response.json<unknown>();
}
function pausePlace(id: string) {
  const entered = deferred();
  const release = deferred();
  provider.respondWith(async (url) => {
    if (url.searchParams.get("place_id") === id) {
      entered.resolve();
      await release.promise;
    }
    return provider.defaultResponse(url);
  });
  return { entered: entered.promise, release: release.resolve };
}

function expectError(
  result: { statusCode: number; json(): unknown },
  status: number,
  code: string
) {
  expect(result.statusCode).toBe(status);
  expect(result.json()).toMatchObject({ error: { code } });
}

describe("Vote and publication authority", () => {
  it("requires the exact bearer participant, including organizers, and ignores account cookies", async () => {
    const otherEvent = "evt_1700000000001_0123456789abcdef";
    const foreignToken = `pt_${"f".repeat(64)}`;
    await database.database.event.create({ data: { id: otherEvent, title: "Other event" } });
    await database.database.participant.create({
      data: {
        id: randomUUID(),
        eventId: otherEvent,
        name: "Foreign",
        color: "mint",
        tokenHash: hashToken(foreignToken),
      },
    });
    const mutations = [
      {
        method: "POST",
        url: `/api/events/${eventId}/participants/${participantId}/votes`,
        payload: { venueId: "new_place", venueData: poisonedVenue },
      },
      {
        method: "DELETE",
        url: `/api/events/${eventId}/participants/${participantId}/votes/new_place`,
      },
      { method: "POST", url: `/api/events/${eventId}/publish`, payload: { venueId: "new_place" } },
      { method: "DELETE", url: `/api/events/${eventId}/publish` },
    ] satisfies { method: "POST" | "DELETE"; url: string; payload?: unknown }[];
    for (const mutation of mutations) {
      expectError(await app.inject(mutation), 401, "UNAUTHORIZED");
      expectError(
        await app.inject({ ...mutation, headers: { cookie: `session_token=${sessionToken}` } }),
        401,
        "UNAUTHORIZED"
      );
      for (const token of ["invalid", foreignToken])
        expectError(
          await app.inject({ ...mutation, headers: authorization(token) }),
          403,
          "FORBIDDEN"
        );
    }
    expectError(await cast("new_place", guestId), 403, "FORBIDDEN");
    expectError(await remove("fixture_place", guestId), 403, "FORBIDDEN");
    expectError(await cast("new_place", participantId, guestToken), 403, "FORBIDDEN");
    expectError(await cast("new_place", randomUUID()), 403, "FORBIDDEN");
    expectError(await publish("new_place", guestToken), 403, "FORBIDDEN");
    expectError(await reopen(guestToken), 403, "FORBIDDEN");
    expect(await database.database.vote.count()).toBe(1);
    expect(provider.requests).toEqual([]);
  });

  it("validates client compatibility fields without using them as provider evidence", async () => {
    const bodies = [
      {},
      { venueId: "new_place" },
      { venueId: "", venueData: poisonedVenue },
      ...[
        { lat: 91 },
        { lng: -181 },
        { rating: 6 },
        { priceLevel: 1.5 },
        { photoUrl: "invalid" },
      ].map((patch) => ({ venueId: "new_place", venueData: { ...poisonedVenue, ...patch } })),
    ];
    for (const payload of bodies)
      expectError(
        await app.inject({
          method: "POST",
          url: `/api/events/${eventId}/participants/${participantId}/votes`,
          headers: authorization(),
          payload,
        }),
        400,
        "VALIDATION_ERROR"
      );
    expectError(await publish(""), 400, "VALIDATION_ERROR");
    const missing = "evt_1700000000002_0123456789abcdef";
    expectError(
      await app.inject(`/api/events/${missing}/votes/statistics`),
      404,
      "EVENT_NOT_FOUND"
    );
    expect(await database.database.vote.count()).toBe(1);
    expect(provider.requests).toEqual([]);
  });
});

describe("Trusted idempotent votes and complete statistics", () => {
  it("refreshes poisoned global metadata through Places, including cross-event and duplicate requests", async () => {
    const result = await cast("fixture_place");
    expect(result.statusCode).toBe(201);
    const { voteId } = voteResponse.parse(result.json<unknown>());
    const stored = await database.database.venue.findUniqueOrThrow({
      where: { id: "fixture_place" },
    });
    expect({
      name: stored.name,
      address: stored.address,
      lat: stored.lat.toNumber(),
      lng: stored.lng.toNumber(),
      category: stored.category,
      rating: stored.rating?.toNumber(),
      priceLevel: stored.priceLevel,
      photoUrl: stored.photoUrl,
    }).toEqual({
      name: "Provider cafe",
      address: "Provider address",
      lat: 33.25,
      lng: -117.75,
      category: "cafe",
      rating: 4.5,
      priceLevel: 2,
      photoUrl: "/api/venues/fixture_place/photo",
    });
    await clearOwnedCache();
    provider.respondWith(() => Promise.resolve({ status: 503 }));
    const repeated = await cast("fixture_place");
    expect(repeated.statusCode).toBe(201);
    expect(repeated.json<unknown>()).toEqual({ success: true, voteId });
    expect(await database.database.venue.findUnique({ where: { id: "fixture_place" } })).toEqual(
      stored
    );
    expect(provider.requests).toHaveLength(1);
    expect(await database.database.vote.count()).toBe(2);
    const view = await app.inject(`/api/events/${eventId}/votes`);
    expect(view.json<unknown>()).toEqual({
      venues: [
        {
          id: "fixture_place",
          name: "Provider cafe",
          address: "Provider address",
          location: { lat: 33.25, lng: -117.75 },
          category: "cafe",
          rating: 4.5,
          priceLevel: 2,
          photoUrl: `${address}/api/venues/fixture_place/photo`,
          voteCount: 2,
          voters: [guestId, participantId],
        },
      ],
      totalVotes: 2,
    });
    const other = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: "Shared place" },
    });
    const created = z
      .object({ id: z.string(), organizerParticipantId: z.uuid(), participantToken: z.string() })
      .parse(other.json<unknown>());
    provider.reset();
    const otherVote = await app.inject({
      method: "POST",
      url: `/api/events/${created.id}/participants/${created.organizerParticipantId}/votes`,
      headers: authorization(created.participantToken),
      payload: {
        venueId: "fixture_place",
        venueData: { ...poisonedVenue, name: "Cross-event poison" },
      },
    });
    expect(otherVote.statusCode).toBe(201);
    expect(
      await database.database.venue.findUnique({ where: { id: "fixture_place" } })
    ).toMatchObject({ name: "Provider cafe", address: "Provider address" });
    expect((await app.inject(`/api/events/${eventId}/votes`)).json<unknown>()).toEqual(
      view.json<unknown>()
    );
  });

  it.each(["invalid", "-5", "9007199254740992", ""])(
    "treats malformed Redis diagnostic counter %j as unavailable",
    async (counter) => {
      await redis.set(`sse:seq:${eventId}`, counter);
      expect(await statistics()).toMatchObject({ seq: 0, totalVotes: 1 });
      const stream = await openStream(`${address}/api/events/${eventId}/stream`, guestToken);
      try {
        await stream.next("heartbeat");
        expect((await cast("fixture_place", guestId, guestToken)).statusCode).toBe(201);
        expect(await stream.next("vote:statistics")).toMatchObject({
          seq: 0,
          totalVotes: 1,
          venues: [{ venueId: "fixture_place", voterIds: [guestId] }],
        });
        await redis.set(`sse:seq:${eventId}`, "4");
        expect(await statistics()).toMatchObject({ seq: 4, totalVotes: 1 });
        expect((await cast("fixture_place", guestId, guestToken)).statusCode).toBe(201);
        expect(await stream.next("vote:statistics")).toMatchObject({ seq: 5, totalVotes: 1 });
      } finally {
        await stream.close();
      }
    }
  );

  it("converges concurrent duplicate POSTs on one persisted ID and returns 201 to each caller", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => cast()));
    expect(results.map((response) => response.statusCode)).toEqual([201, 201, 201, 201, 201, 201]);
    const ids = results.map((response) => voteResponse.parse(response.json<unknown>()).voteId);
    expect(new Set(ids).size).toBe(1);
    expect(
      await database.database.vote.findMany({
        where: { venueId: "new_place" },
        select: { id: true, eventId: true, participantId: true, venueId: true },
      })
    ).toEqual([{ id: ids[0], eventId, participantId, venueId: "new_place" }]);
  });

  it("orders complete statistics by vote count and counts rows across venues", async () => {
    expect((await cast()).statusCode).toBe(201);
    expect((await cast("new_place", guestId, guestToken)).statusCode).toBe(201);
    const result = await statistics();
    expect(result).toEqual({
      eventId,
      seq: 2,
      totalVotes: 3,
      updatedAt: stamp.parse(result).updatedAt,
      venues: [
        { venueId: "new_place", voteCount: 2, voterIds: [participantId, guestId] },
        { venueId: "fixture_place", voteCount: 1, voterIds: [guestId] },
      ],
    });
  });

  it("sends full SSE snapshots for additions, non-final removal, and final removal with a progressing diagnostic counter", async () => {
    const stream = await openStream(`${address}/api/events/${eventId}/stream`, guestToken);
    try {
      await stream.next("heartbeat");
      expect((await cast("fixture_place")).statusCode).toBe(201);
      const addition = await stream.next("vote:statistics");
      const firstStamp = stamp.parse(addition);
      expect(addition).toEqual({
        eventId,
        seq: 1,
        venues: [
          {
            venueId: "fixture_place",
            voteCount: 2,
            voterIds: [guestId, participantId],
            voterNames: [guestId, participantId],
          },
        ],
        totalVotes: 2,
        updatedAt: firstStamp.updatedAt,
      });
      const current = await statistics();
      expect(current).toEqual({
        eventId,
        seq: 1,
        venues: [{ venueId: "fixture_place", voteCount: 2, voterIds: [guestId, participantId] }],
        totalVotes: 2,
        updatedAt: stamp.parse(current).updatedAt,
      });
      expect((await remove("fixture_place")).json<unknown>()).toEqual({
        success: true,
        deleted: true,
      });
      const nonFinal = await stream.next("vote:statistics");
      expect(nonFinal).toEqual({
        eventId,
        seq: 2,
        venues: [
          { venueId: "fixture_place", voteCount: 1, voterIds: [guestId], voterNames: [guestId] },
        ],
        totalVotes: 1,
        updatedAt: stamp.parse(nonFinal).updatedAt,
      });
      expect((await remove("fixture_place", guestId, guestToken)).json<unknown>()).toEqual({
        success: true,
        deleted: true,
      });
      const empty = await stream.next("vote:statistics");
      expect(empty).toEqual({
        eventId,
        seq: 3,
        venues: [],
        totalVotes: 0,
        updatedAt: stamp.parse(empty).updatedAt,
      });
      const absent = await remove("fixture_place", guestId, guestToken);
      expect(absent.statusCode).toBe(200);
      expect(absent.json<unknown>()).toEqual({ success: true, deleted: false });
      expect((await app.inject(`/api/events/${eventId}/votes`)).json<unknown>()).toEqual({
        venues: [],
        totalVotes: 0,
      });
      expect(await statistics()).toMatchObject({ seq: 3, venues: [], totalVotes: 0 });
      expect(await database.database.venue.count()).toBe(1);
      expect(await database.database.vote.count()).toBe(0);
    } finally {
      await stream.close();
    }
  });
});

describe("Publication transitions", () => {
  it("publishes an unvoted valid place with a full Event and trusted SSE, then reopens with explicit nulls", async () => {
    const stream = await openStream(`${address}/api/events/${eventId}/stream`, guestToken);
    try {
      await stream.next("heartbeat");
      const result = await publish();
      expect(result.statusCode).toBe(200);
      const meeting = z
        .object({ publishedAt: z.iso.datetime(), updatedAt: z.iso.datetime() })
        .parse(result.json<unknown>());
      expect(result.json<unknown>()).toEqual({
        id: eventId,
        title: "Imported meeting",
        meetingTime: null,
        publishedVenueId: "new_place",
        publishedAt: meeting.publishedAt,
        createdAt: "2025-12-29T12:34:56.789Z",
        updatedAt: meeting.updatedAt,
        participants: [
          {
            id: participantId,
            name: "Original organizer",
            address: null,
            location: null,
            color: "coral",
            fuzzyLocation: false,
            isOrganizer: true,
          },
          {
            id: guestId,
            name: "Original guest",
            address: null,
            location: { lat: 32.1234567, lng: -117.1234567 },
            color: "mint",
            fuzzyLocation: true,
            isOrganizer: false,
          },
        ],
        mec: null,
        settings: { allowParticipantsAfterPublish: false },
      });
      expect(await stream.next("event:published")).toEqual({
        event: {
          id: eventId,
          title: "Imported meeting",
          meetingTime: null,
          publishedAt: meeting.publishedAt,
          publishedVenueId: "new_place",
        },
        venue: {
          id: "new_place",
          name: "Provider cafe",
          address: "Provider address",
          lat: 33.25,
          lng: -117.75,
        },
      });
      expect(provider.requests).toHaveLength(1);
      expect(await database.database.vote.count()).toBe(1);
      expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
        publishedAt: new Date(meeting.publishedAt),
        publishedVenueId: "new_place",
      });
      expectError(await publish(), 409, "EVENT_ALREADY_PUBLISHED");
      expectError(await cast("fixture_place", guestId, guestToken), 409, "EVENT_ALREADY_PUBLISHED");
      expect((await remove("fixture_place", guestId, guestToken)).json<unknown>()).toEqual({
        success: true,
        deleted: true,
      });
      const reopened = await reopen();
      expect(reopened.statusCode).toBe(200);
      const reopenedAt = z
        .object({ updatedAt: z.iso.datetime() })
        .parse(reopened.json<unknown>()).updatedAt;
      expect(reopened.json<unknown>()).toEqual({
        ...result.json<Record<string, unknown>>(),
        publishedAt: null,
        publishedVenueId: null,
        updatedAt: reopenedAt,
      });
      expect(await stream.next("event:updated")).toEqual({
        event: {
          id: eventId,
          title: "Imported meeting",
          meetingTime: null,
          publishedAt: null,
          publishedVenueId: null,
        },
      });
      expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
        publishedAt: null,
        publishedVenueId: null,
      });
      expectError(await reopen(), 409, "EVENT_NOT_PUBLISHED");
      expect((await cast("new_place", guestId, guestToken)).statusCode).toBe(201);
    } finally {
      await stream.close();
    }
  });

  it("allows exactly one of two concurrent duplicate transitions and retains votes", async () => {
    const published = await Promise.all([publish("first_place"), publish("second_place")]);
    expect(published.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const winner = published.find((result) => result.statusCode === 200);
    if (!winner) throw new Error("Publication did not succeed");
    const selected = z
      .object({ publishedVenueId: z.string(), publishedAt: z.iso.datetime() })
      .parse(winner.json<unknown>());
    expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
      publishedVenueId: selected.publishedVenueId,
      publishedAt: new Date(selected.publishedAt),
    });
    const reopened = await Promise.all([reopen(), reopen()]);
    expect(reopened.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const rejected = reopened.find((result) => result.statusCode === 409);
    expect(rejected?.json<unknown>()).toMatchObject({ error: { code: "EVENT_NOT_PUBLISHED" } });
    expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
      publishedVenueId: null,
      publishedAt: null,
    });
    expect(await database.database.vote.count()).toBe(1);
  });
});

describe("Provider failures and authority changes during preparation", () => {
  it.each([
    ["missing", { status: 200, body: { status: "NOT_FOUND" } }, 400, "VALIDATION_ERROR"],
    ["unavailable", { status: 503 }, 502, "EXTERNAL_SERVICE_ERROR"],
  ] satisfies [string, ProviderReply, number, string][])(
    "does not mutate votes or publication when the provider is %s",
    async (_name, reply, status, code) => {
      provider.respondWith(() => Promise.resolve(reply));
      expectError(await cast(), status, code);
      expectError(await publish(), status, code);
      expect(await database.database.vote.count()).toBe(1);
      expect(await database.database.venue.count()).toBe(1);
      expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
        publishedAt: null,
        publishedVenueId: null,
      });
    }
  );

  it.each(["participant", "publication", "event"])(
    "rechecks a delayed vote after %s changes",
    async (change) => {
      const paused = pausePlace("delayed_place");
      const pending = cast("delayed_place", guestId, guestToken);
      try {
        await paused.entered;
        if (change === "participant")
          expect(
            (
              await app.inject({
                method: "DELETE",
                url: `/api/events/${eventId}/participants/${guestId}`,
                headers: authorization(),
              })
            ).statusCode
          ).toBe(200);
        if (change === "publication") expect((await publish()).statusCode).toBe(200);
        if (change === "event")
          expect(
            (
              await app.inject({
                method: "DELETE",
                url: `/api/events/${eventId}`,
                headers: authorization(),
              })
            ).statusCode
          ).toBe(200);
      } finally {
        paused.release();
      }
      const result = await pending;
      expectError(
        result,
        change === "event" ? 404 : change === "publication" ? 409 : 403,
        change === "event"
          ? "EVENT_NOT_FOUND"
          : change === "publication"
            ? "EVENT_ALREADY_PUBLISHED"
            : "FORBIDDEN"
      );
      expect(await database.database.vote.count({ where: { venueId: "delayed_place" } })).toBe(0);
      expect(
        await database.database.venue.findUnique({ where: { id: "delayed_place" } })
      ).toMatchObject({ name: "Provider cafe" });
    }
  );

  it.each(["authority", "publication", "event"])(
    "rechecks a delayed publish after %s changes",
    async (change) => {
      const paused = pausePlace("delayed_place");
      const pending = publish("delayed_place");
      try {
        await paused.entered;
        if (change === "authority")
          await database.database.participant.update({
            where: { id: participantId },
            data: { isOrganizer: false },
          });
        if (change === "publication") expect((await publish("winning_place")).statusCode).toBe(200);
        if (change === "event")
          expect(
            (
              await app.inject({
                method: "DELETE",
                url: `/api/events/${eventId}`,
                headers: authorization(),
              })
            ).statusCode
          ).toBe(200);
      } finally {
        paused.release();
      }
      expectError(
        await pending,
        change === "event" ? 404 : change === "publication" ? 409 : 403,
        change === "event"
          ? "EVENT_NOT_FOUND"
          : change === "publication"
            ? "EVENT_ALREADY_PUBLISHED"
            : "FORBIDDEN"
      );
      if (change !== "event")
        expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
          publishedVenueId: change === "publication" ? "winning_place" : null,
        });
    }
  );
});

describe("Concurrent legal histories and notification outages", () => {
  it("keeps distinct simultaneous voters and independent removals", async () => {
    const additions = await Promise.all([cast(), cast("new_place", guestId, guestToken)]);
    expect(additions.map((result) => result.statusCode)).toEqual([201, 201]);
    expect(
      await database.database.vote.findMany({
        where: { venueId: "new_place" },
        select: { participantId: true },
        orderBy: { participantId: "asc" },
      })
    ).toEqual([{ participantId }, { participantId: guestId }]);
    const removals = await Promise.all([remove(), remove("new_place", guestId, guestToken)]);
    expect(removals.map((result) => result.json<unknown>())).toEqual([
      { success: true, deleted: true },
      { success: true, deleted: true },
    ]);
    expect(await database.database.vote.count({ where: { venueId: "new_place" } })).toBe(0);
    expect(await database.database.vote.count()).toBe(1);
  });

  it("serializes a cast and removal of the same vote without an unrelated deletion", async () => {
    const [added, removed] = await Promise.all([cast(), remove()]);
    expect(added.statusCode).toBe(201);
    expect(removed.statusCode).toBe(200);
    const removal = z
      .object({ success: z.literal(true), deleted: z.boolean() })
      .parse(removed.json<unknown>());
    expect(await database.database.vote.count({ where: { venueId: "new_place" } })).toBe(
      removal.deleted ? 0 : 1
    );
    expect(
      await database.database.vote.count({
        where: { venueId: "fixture_place", participantId: guestId },
      })
    ).toBe(1);
  });

  it("cascades a racing guest vote when its participant is removed", async () => {
    const [vote, deletion] = await Promise.all([
      cast("new_place", guestId, guestToken),
      app.inject({
        method: "DELETE",
        url: `/api/events/${eventId}/participants/${guestId}`,
        headers: authorization(),
      }),
    ]);
    expect(deletion.statusCode).toBe(200);
    expect([201, 403]).toContain(vote.statusCode);
    expect(await database.database.vote.count()).toBe(0);
    expect(await database.database.participant.count()).toBe(1);
  });

  it("allows only cast-before-publication or rejected-cast histories", async () => {
    const [vote, publication] = await Promise.all([cast(), publish("published_place")]);
    expect(publication.statusCode).toBe(200);
    expect([201, 409]).toContain(vote.statusCode);
    expect(await database.database.vote.count({ where: { venueId: "new_place" } })).toBe(
      vote.statusCode === 201 ? 1 : 0
    );
    expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
      publishedVenueId: "published_place",
      publishedAt: new Date(
        z.object({ publishedAt: z.iso.datetime() }).parse(publication.json<unknown>()).publishedAt
      ),
    });
    expectError(await cast("later_place"), 409, "EVENT_ALREADY_PUBLISHED");
  });

  it("commits votes and publication with Redis offline and sends local complete snapshots", async () => {
    const reserved = createServer();
    await new Promise<void>((resolve) => reserved.listen(0, "127.0.0.1", resolve));
    const port = reserved.address();
    if (!port || typeof port === "string") throw new Error("Missing test port");
    await new Promise<void>((resolve, reject) =>
      reserved.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
    const degraded = await startApp({ redisUrl: `redis://127.0.0.1:${String(port.port)}` });
    const stream = await openStream(`${degraded.address}/api/events/${eventId}/stream`, guestToken);
    try {
      await stream.next("heartbeat");
      const result = await cast("new_place", participantId, participantToken, degraded.app);
      expect(result.statusCode).toBe(201);
      const notice = await stream.next("vote:statistics");
      expect(notice).toMatchObject({
        seq: 0,
        totalVotes: 2,
        venues: [
          { venueId: "fixture_place", voterIds: [guestId] },
          { venueId: "new_place", voterIds: [participantId] },
        ],
      });
      const publication = await publish("new_place", participantToken, degraded.app);
      expect(publication.statusCode).toBe(200);
      expect(await stream.next("event:published")).toMatchObject({
        event: { publishedVenueId: "new_place" },
        venue: { name: "Provider cafe" },
      });
      expect(await database.database.vote.count()).toBe(2);
      expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
        publishedVenueId: "new_place",
        publishedAt: new Date(
          z.object({ publishedAt: z.iso.datetime() }).parse(publication.json<unknown>()).publishedAt
        ),
      });
      expect(
        (await remove("new_place", participantId, participantToken, degraded.app)).statusCode
      ).toBe(200);
      expect((await reopen(participantToken, degraded.app)).statusCode).toBe(200);
      expect(await database.database.vote.count()).toBe(1);
      expect(await database.database.event.findUnique({ where: { id: eventId } })).toMatchObject({
        publishedAt: null,
        publishedVenueId: null,
      });
      expect((await degraded.app.inject("/health/ready")).json<unknown>()).toMatchObject({
        status: "degraded",
        services: { database: "ok", redis: "unhealthy" },
      });
    } finally {
      await stream.close();
      await degraded.app.close();
    }
  });
});
