import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "../src/app.js";
import { importData } from "../scripts/import-data.js";
import { createTestDatabase, type TestDatabase } from "./support/database.js";
import { startGeocoder, foundAddress, deferred } from "./support/geocoder.js";
import { openStream } from "./support/stream.js";
import {
  fixture,
  eventId,
  participantId,
  guestId,
  participantToken,
  guestToken,
  userId,
  hashToken,
} from "./support/fixture.js";

const person = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  color: z.string(),
  fuzzyLocation: z.boolean(),
  isOrganizer: z.boolean(),
});
const joinedPerson = person.extend({ participantToken: z.string() });
const authorization = (token = participantToken) => ({ authorization: `Bearer ${token}` });
const url = (id = guestId) => `/api/events/${eventId}/participants/${id}`;
const collection = `/api/events/${eventId}/participants`;
let database: TestDatabase;
let provider: Awaited<ReturnType<typeof startGeocoder>>;
let app: FastifyInstance;
let address: string;
const cleanups: (() => Promise<void>)[] = [];

beforeAll(async () => {
  database = await createTestDatabase();
  cleanups.push(() => database.close());
  provider = await startGeocoder();
  cleanups.push(() => provider.close());
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for integration tests");
  app = await makeApp({
    databaseUrl: database.databaseUrl,
    redisUrl,
    environment: "test",
    logLevel: "silent",
    googleMapsApiKey: "provider-fixture-key",
    geocodeEndpoint: provider.endpoint,
    geocodeTimeoutMs: 1000,
    redisTimeoutMs: 1000,
    heartbeatIntervalMs: 1000,
    streamTimeoutMs: 10000,
  });
  cleanups.push(() => app.close());
  address = await app.listen({ host: "127.0.0.1", port: 0 });
});

beforeEach(async () => {
  provider.reset();
  await database.reset();
  await importData(database.database, fixture());
});

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

function distance(point: { lat: number; lng: number }) {
  const radians = Math.PI / 180;
  const dLat = (point.lat - 32.9) * radians;
  const dLng = (point.lng + 117.2) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(32.9 * radians) * Math.cos(point.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function rows() {
  return {
    participants: await database.database.participant.findMany({ orderBy: { id: "asc" } }),
    votes: await database.database.vote.findMany({ orderBy: { id: "asc" } }),
  };
}

describe("participant lifecycle over HTTP", () => {
  it("joins with a persisted credential, identifies privately, and adds a tokenless managed person", async () => {
    const joined = await app.inject({
      method: "POST",
      url: collection,
      payload: { name: "Self", address: "Self address" },
    });
    expect(joined.statusCode).toBe(201);
    const self = joinedPerson.parse(joined.json<unknown>());
    expect(self).toMatchObject({
      name: "Self",
      address: "Self address",
      location: { lat: 32.9, lng: -117.2 },
      color: "teal",
      fuzzyLocation: false,
      isOrganizer: false,
    });
    expect(self.participantToken).toMatch(/^pt_[a-f0-9]{64}$/);
    expect(
      await database.database.participant.findUnique({ where: { id: self.id } })
    ).toMatchObject({
      eventId,
      tokenHash: hashToken(self.participantToken),
      formattedAddress: "Validated private address",
      isOrganizer: false,
    });
    const me = await app.inject({
      url: `/api/events/${eventId}/me`,
      headers: authorization(self.participantToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<unknown>()).toEqual({
      participantId: self.id,
      name: "Self",
      address: "Self address",
      lat: 32.9,
      lng: -117.2,
      color: "teal",
      isOrganizer: false,
    });
    const added = await app.inject({
      method: "POST",
      url: collection,
      headers: authorization(),
      payload: { name: "Managed", address: "Managed address" },
    });
    expect(added.statusCode).toBe(201);
    const managed = person.strict().parse(added.json<unknown>());
    expect(managed).toMatchObject({ name: "Managed", color: "gold", isOrganizer: false });
    expect(
      await database.database.participant.findUnique({ where: { id: managed.id } })
    ).toMatchObject({ tokenHash: null, isOrganizer: false });
    expect(provider.requests).toEqual([
      { address: "Self address", key: "provider-fixture-key" },
      { address: "Managed address", key: "provider-fixture-key" },
    ]);
  });

  it("redacts fuzzy HTTP and SSE data while preserving private self identity and saved coordinates", async () => {
    const stream = await openStream(`${address}/api/events/${eventId}/stream`, participantToken);
    try {
      const heartbeat = z
        .object({ timestamp: z.iso.datetime() })
        .parse(await stream.next("heartbeat"));
      expect(Date.parse(heartbeat.timestamp)).toBeGreaterThan(0);
      const response = await app.inject({
        method: "POST",
        url: collection,
        payload: { name: "Fuzzy person", address: "Secret house", fuzzyLocation: true },
      });
      expect(response.statusCode).toBe(201);
      const person = joinedPerson.parse(response.json<unknown>());
      expect(person.address).toBeNull();
      expect(person.fuzzyLocation).toBe(true);
      if (!person.location) throw new Error("Fuzzy participant has no location");
      expect(distance(person.location)).toBeGreaterThanOrEqual(804.5);
      expect(distance(person.location)).toBeLessThanOrEqual(1609.5);
      const added = await stream.next("participant:added");
      expect(added).toEqual({
        participant: {
          id: person.id,
          name: "Fuzzy person",
          address: null,
          lat: person.location.lat,
          lng: person.location.lng,
          color: person.color,
          fuzzyLocation: true,
          isOrganizer: false,
        },
      });
      expect(JSON.stringify(added)).not.toContain("Secret house");
      const publicEvent = await app.inject(`/api/events/${eventId}`);
      expect(publicEvent.statusCode).toBe(200);
      expect(publicEvent.body).not.toContain("Secret house");
      expect(publicEvent.body).not.toContain("Example address");
      const me = await app.inject({
        url: `/api/events/${eventId}/me`,
        headers: authorization(person.participantToken),
      });
      expect(me.json<unknown>()).toMatchObject({
        participantId: person.id,
        address: "Secret house",
        lat: person.location.lat,
        lng: person.location.lng,
      });
      const before = await database.database.participant.findUniqueOrThrow({
        where: { id: person.id },
      });
      const renamed = await app.inject({
        method: "PATCH",
        url: url(person.id),
        headers: authorization(person.participantToken),
        payload: { name: "Renamed" },
      });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.json<unknown>()).toMatchObject({
        name: "Renamed",
        address: null,
        location: person.location,
        fuzzyLocation: true,
      });
      expect(await stream.next("participant:updated")).toMatchObject({
        participant: {
          name: "Renamed",
          address: null,
          fuzzyLocation: true,
          lat: person.location.lat,
          lng: person.location.lng,
        },
      });
      const unchanged = await app.inject({
        method: "PATCH",
        url: url(person.id),
        headers: authorization(person.participantToken),
        payload: { name: "Same source", address: "Secret house", fuzzyLocation: true },
      });
      expect(unchanged.statusCode).toBe(200);
      const after = await database.database.participant.findUniqueOrThrow({
        where: { id: person.id },
      });
      expect(after).toMatchObject({
        name: "Same source",
        address: "Secret house",
        formattedAddress: before.formattedAddress,
        lat: before.lat,
        lng: before.lng,
        tokenHash: before.tokenHash,
      });
      expect(provider.requests).toHaveLength(1);
    } finally {
      await stream.close();
    }
  });

  it("keeps imported fuzzy coordinates and allows organizer location/privacy edits under the existing policy", async () => {
    const renamed = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(guestToken),
      payload: { name: "Imported rename" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<unknown>()).toMatchObject({
      address: null,
      location: { lat: 32.1234567, lng: -117.1234567 },
      fuzzyLocation: true,
      color: "mint",
    });
    expect(provider.requests).toHaveLength(0);
    const visible = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(),
      payload: { fuzzyLocation: false },
    });
    expect(visible.statusCode).toBe(200);
    expect(visible.json<unknown>()).toMatchObject({
      address: "Example address",
      location: { lat: 32.9, lng: -117.2 },
      fuzzyLocation: false,
    });
    expect(provider.requests).toEqual([
      { address: "Example address", key: "provider-fixture-key" },
    ]);
    const fuzzy = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(),
      payload: { address: "New private location", fuzzyLocation: true },
    });
    expect(fuzzy.statusCode).toBe(200);
    const snapshot = person.parse(fuzzy.json<unknown>());
    expect(snapshot.address).toBeNull();
    expect(snapshot.fuzzyLocation).toBe(true);
    expect(
      await database.database.participant.findUnique({ where: { id: guestId } })
    ).toMatchObject({
      address: "New private location",
      name: "Imported rename",
      fuzzyLocation: true,
    });
  });

  it("accepts organizer location entry and a locationless fuzzy flag without geocoding the latter", async () => {
    const preference = await app.inject({
      method: "PATCH",
      url: url(participantId),
      headers: authorization(),
      payload: { fuzzyLocation: true },
    });
    expect(preference.statusCode).toBe(200);
    expect(preference.json<unknown>()).toMatchObject({
      address: null,
      location: null,
      fuzzyLocation: true,
      isOrganizer: true,
    });
    expect(provider.requests).toHaveLength(0);
    const located = await app.inject({
      method: "PATCH",
      url: url(participantId),
      headers: authorization(),
      payload: { address: "Organizer private address" },
    });
    expect(located.statusCode).toBe(200);
    const snapshot = person.parse(located.json<unknown>());
    expect(snapshot).toMatchObject({ address: null, fuzzyLocation: true, isOrganizer: true });
    if (!snapshot.location) throw new Error("Organizer location was not saved");
    expect(distance(snapshot.location)).toBeGreaterThanOrEqual(804.5);
    expect(distance(snapshot.location)).toBeLessThanOrEqual(1609.5);
    expect(provider.requests).toEqual([
      { address: "Organizer private address", key: "provider-fixture-key" },
    ]);
  });

  it("repairs incomplete imported coordinates only when the address is explicitly replaced", async () => {
    await database.database.participant.update({ where: { id: guestId }, data: { lat: null } });
    const renamed = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(guestToken),
      payload: { name: "Unlocated guest" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<unknown>()).toMatchObject({
      name: "Unlocated guest",
      location: null,
      fuzzyLocation: true,
    });
    expect(provider.requests).toHaveLength(0);
    const repaired = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(guestToken),
      payload: { address: "Example address" },
    });
    expect(repaired.statusCode).toBe(200);
    const result = person.parse(repaired.json<unknown>());
    expect(result).toMatchObject({ name: "Unlocated guest", address: null, fuzzyLocation: true });
    if (!result.location) throw new Error("Incomplete location was not repaired");
    expect(distance(result.location)).toBeGreaterThanOrEqual(804.5);
    expect(distance(result.location)).toBeLessThanOrEqual(1609.5);
    expect(provider.requests).toEqual([
      { address: "Example address", key: "provider-fixture-key" },
    ]);
  });

  it.each([
    { name: "missing name", body: { address: "Address" } },
    { name: "missing address", body: { name: "Person" } },
    { name: "null address", body: { name: "Person", address: null } },
    { name: "oversized name", body: { name: "x".repeat(51), address: "Address" } },
    { name: "oversized address", body: { name: "Person", address: "x".repeat(256) } },
  ])("rejects invalid creation: $name", async ({ body }) => {
    const response = await app.inject({ method: "POST", url: collection, payload: body });
    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(await database.database.participant.count()).toBe(2);
    expect(provider.requests).toHaveLength(0);
  });

  it.each([{}, { address: null }, { address: "" }, { name: "" }, { fuzzyLocation: "true" }])(
    "rejects invalid patch %#",
    async (payload) => {
      const response = await app.inject({
        method: "PATCH",
        url: url(),
        headers: authorization(),
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json<unknown>()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(
        await database.database.participant.findUnique({ where: { id: guestId } })
      ).toMatchObject({ name: "Original guest", address: "Example address", fuzzyLocation: true });
    }
  );

  it("rejects missing, malformed, non-organizer, cross-event, and foreign-target credentials before geocoding", async () => {
    const second = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: "Other" },
    });
    const other = z
      .object({ participantToken: z.string(), organizerParticipantId: z.string() })
      .parse(second.json<unknown>());
    const checks = [
      {
        method: "POST" as const,
        url: collection,
        headers: { authorization: "Basic invalid" },
        payload: { name: "Denied", address: "Secret" },
        status: 401,
      },
      {
        method: "POST" as const,
        url: collection,
        headers: authorization(guestToken),
        payload: { name: "Denied", address: "Secret" },
        status: 403,
      },
      {
        method: "POST" as const,
        url: collection,
        headers: authorization(other.participantToken),
        payload: { name: "Denied", address: "Secret" },
        status: 403,
      },
      {
        method: "PATCH" as const,
        url: url(),
        headers: {},
        payload: { address: "Secret" },
        status: 401,
      },
      {
        method: "PATCH" as const,
        url: url(participantId),
        headers: authorization(guestToken),
        payload: { address: "Secret" },
        status: 403,
      },
      {
        method: "PATCH" as const,
        url: url(other.organizerParticipantId),
        headers: authorization(),
        payload: { address: "Secret" },
        status: 404,
      },
      {
        method: "PATCH" as const,
        url: url(),
        headers: authorization("wrong"),
        payload: { address: "Secret" },
        status: 403,
      },
    ];
    for (const { status, ...request } of checks)
      expect((await app.inject(request)).statusCode).toBe(status);
    expect(provider.requests).toHaveLength(0);
    expect(await database.database.participant.count()).toBe(3);
  });

  it("locks joins, organizer additions, all edits and removal after publication", async () => {
    await database.database.event.update({
      where: { id: eventId },
      data: { publishedAt: new Date(), publishedVenueId: "fixture_place" },
    });
    const requests = [
      {
        method: "POST" as const,
        url: collection,
        payload: { name: "No join", address: "Address" },
      },
      {
        method: "POST" as const,
        url: collection,
        headers: authorization(),
        payload: { name: "No add", address: "Address" },
      },
      {
        method: "PATCH" as const,
        url: url(),
        headers: authorization(),
        payload: { name: "No rename" },
      },
      {
        method: "PATCH" as const,
        url: url(),
        headers: authorization(guestToken),
        payload: { address: "Address" },
      },
      { method: "DELETE" as const, url: url(), headers: authorization(guestToken) },
    ];
    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(409);
      expect(response.json<unknown>()).toEqual({
        error: { code: "EVENT_ALREADY_PUBLISHED", message: "Event has already been published" },
      });
    }
    expect(provider.requests).toHaveLength(0);
    expect(await database.database.participant.count()).toBe(2);
    expect(await database.database.vote.count()).toBe(1);
  });

  it("removes self and votes atomically, retains venue and account links, and broadcasts canonical totals", async () => {
    await database.database.userEvent.update({
      where: { userId_eventId: { userId, eventId } },
      data: { participantId: guestId, role: "participant" },
    });
    const stream = await openStream(`${address}/api/events/${eventId}/stream`, participantToken);
    try {
      await stream.next("heartbeat");
      const removed = await app.inject({
        method: "DELETE",
        url: url(),
        headers: authorization(guestToken),
      });
      expect(removed.statusCode).toBe(200);
      expect(removed.json<unknown>()).toEqual({
        success: true,
        message: "Participant deleted successfully",
      });
      expect(await database.database.participant.count()).toBe(1);
      expect(await database.database.vote.count()).toBe(0);
      expect(await database.database.venue.count()).toBe(1);
      expect(await database.database.user.count()).toBe(1);
      expect(
        await database.database.userEvent.findUnique({
          where: { userId_eventId: { userId, eventId } },
        })
      ).toMatchObject({ participantId: null, role: "participant" });
      expect(await stream.next("participant:removed")).toEqual({ participantId: guestId });
      const statistics = await stream.next("vote:statistics");
      const { updatedAt } = z.object({ updatedAt: z.iso.datetime() }).parse(statistics);
      expect(statistics).toEqual({
        eventId,
        venues: [],
        totalVotes: 0,
        updatedAt,
      });
      expect((await app.inject(`/api/events/${eventId}/votes`)).json<unknown>()).toEqual({
        venues: [],
        totalVotes: 0,
      });
      expect(
        (await app.inject({ url: `/api/events/${eventId}/me`, headers: authorization(guestToken) }))
          .statusCode
      ).toBe(403);
      expect(
        (
          await app.inject({
            url: `/api/events/${eventId}/stream`,
            headers: authorization(guestToken),
          })
        ).statusCode
      ).toBe(403);
    } finally {
      await stream.close();
    }
  });

  it("protects organizer and other people's records while allowing organizer removal", async () => {
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: url(participantId),
          headers: authorization(guestToken),
        })
      ).statusCode
    ).toBe(403);
    const organizer = await app.inject({
      method: "DELETE",
      url: url(participantId),
      headers: authorization(),
    });
    expect(organizer.statusCode).toBe(403);
    expect(organizer.json<unknown>()).toEqual({
      error: { code: "FORBIDDEN", message: "Cannot delete the organizer participant" },
    });
    expect(
      (await app.inject({ method: "DELETE", url: url(randomUUID()), headers: authorization() }))
        .statusCode
    ).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url: url(), headers: authorization() })).statusCode
    ).toBe(200);
    expect(await database.database.participant.findMany({ select: { id: true } })).toEqual([
      { id: participantId },
    ]);
  });

  it("assigns unused colors to concurrent joins and persists every returned token", async () => {
    const replies = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        app.inject({
          method: "POST",
          url: collection,
          payload: { name: `Concurrent ${String(index)}`, address: `Address ${String(index)}` },
        })
      )
    );
    expect(replies.map((response) => response.statusCode)).toEqual([201, 201, 201]);
    const joined = replies.map((response) => joinedPerson.parse(response.json<unknown>()));
    expect(joined.map((entry) => entry.color).sort()).toEqual(["gold", "orchid", "teal"]);
    for (const entry of joined)
      expect(
        await database.database.participant.findUnique({ where: { id: entry.id } })
      ).toMatchObject({ tokenHash: hashToken(entry.participantToken), color: entry.color });
    expect(await database.database.participant.count()).toBe(5);
  });
});

describe("external geocoder failures", () => {
  it.each(["quota", "google-server", "disconnect", "rate-limit", "upstream"])(
    "recovers from one transient %s within the operation deadline",
    async (failure) => {
      let attempts = 0;
      provider.respondWith(() => {
        attempts++;
        if (attempts !== 1) return Promise.resolve(foundAddress);
        if (failure === "disconnect") return Promise.resolve({ kind: "disconnect" });
        if (failure === "quota" || failure === "google-server")
          return Promise.resolve({
            status: 200,
            body: { status: failure === "quota" ? "OVER_QUERY_LIMIT" : "UNKNOWN_ERROR" },
          });
        return Promise.resolve({ status: failure === "rate-limit" ? 429 : 503, body: {} });
      });
      const response = await app.inject({
        method: "POST",
        url: collection,
        payload: { name: "Retry success", address: "Transient address" },
      });
      expect(response.statusCode).toBe(201);
      const result = joinedPerson.parse(response.json<unknown>());
      expect(result).toMatchObject({
        name: "Retry success",
        address: "Transient address",
        location: { lat: 32.9, lng: -117.2 },
      });
      expect(attempts).toBe(2);
      expect(
        await database.database.participant.findUnique({ where: { id: result.id } })
      ).toMatchObject({
        tokenHash: hashToken(result.participantToken),
        address: "Transient address",
      });
    }
  );
  it.each([
    {
      name: "no match",
      reply: { status: 200, body: { status: "ZERO_RESULTS", results: [] } },
      status: 400,
      code: "ADDRESS_NOT_FOUND",
    },
    {
      name: "denied credentials",
      reply: {
        status: 200,
        body: { status: "REQUEST_DENIED", error_message: "provider-fixture-key Secret address" },
      },
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    },
    {
      name: "quota",
      reply: { status: 200, body: { status: "OVER_QUERY_LIMIT" } },
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    },
    {
      name: "HTTP failure",
      reply: { status: 503, body: {} },
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    },
    {
      name: "malformed result",
      reply: { status: 200, body: { status: "OK", results: [] } },
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    },
    {
      name: "out-of-bounds point",
      reply: {
        status: 200,
        body: {
          status: "OK",
          results: [
            { formatted_address: "Bad point", geometry: { location: { lat: 91, lng: 20 } } },
          ],
        },
      },
      status: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    },
  ])("does not mutate after $name", async ({ name, reply, status, code }) => {
    provider.respondWith(() => Promise.resolve(reply));
    const before = await rows();
    for (const request of [
      {
        method: "POST" as const,
        url: collection,
        payload: { name: "No insert", address: "Secret address" },
      },
      {
        method: "PATCH" as const,
        url: url(),
        headers: authorization(),
        payload: { name: "No update", address: "Secret address" },
      },
    ]) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(status);
      expect(response.json<unknown>()).toMatchObject({ error: { code } });
      expect(response.body).not.toContain("Secret address");
      expect(response.body).not.toContain("provider-fixture-key");
    }
    expect(await rows()).toEqual(before);
    expect(provider.requests).toHaveLength(name === "quota" || name === "HTTP failure" ? 6 : 2);
  });

  it("bounds provider timeout and maps a dropped connection without writing", async () => {
    const release = deferred();
    provider.respondWith(async () => {
      await release.promise;
      return foundAddress;
    });
    const before = await rows();
    const timedOut = await app.inject({
      method: "POST",
      url: collection,
      payload: { name: "Timeout", address: "Slow provider" },
    });
    release.resolve();
    expect(timedOut.statusCode).toBe(502);
    expect(timedOut.json<unknown>()).toEqual({
      error: {
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Address lookup is temporarily unavailable",
      },
    });
    provider.respondWith(() => Promise.resolve({ kind: "disconnect" }));
    const disconnected = await app.inject({
      method: "PATCH",
      url: url(),
      headers: authorization(),
      payload: { address: "Dropped provider" },
    });
    expect(disconnected.statusCode).toBe(502);
    expect(await rows()).toEqual(before);
  });
});

describe("state changes while Google is outside the write transaction", () => {
  async function pendingEdit() {
    const entered = deferred();
    const release = deferred();
    provider.respondWith(async () => {
      entered.resolve();
      await release.promise;
      return foundAddress;
    });
    const pending = app
      .inject({
        method: "PATCH",
        url: url(),
        headers: authorization(guestToken),
        payload: { address: "Prepared address", fuzzyLocation: false },
      })
      .then((response) => response);
    await entered.promise;
    return { pending, release: release.resolve };
  }

  it("rejects an edit when publication commits during geocoding", async () => {
    const work = await pendingEdit();
    try {
      await database.database.event.update({
        where: { id: eventId },
        data: { publishedAt: new Date(), publishedVenueId: "fixture_place" },
      });
    } finally {
      work.release();
    }
    const response = await work.pending;
    expect(response.statusCode).toBe(409);
    expect(response.json<unknown>()).toMatchObject({ error: { code: "EVENT_ALREADY_PUBLISHED" } });
    expect(
      await database.database.participant.findUnique({ where: { id: guestId } })
    ).toMatchObject({ address: "Example address", fuzzyLocation: true });
  });

  it.each(["delete", "revoke"])(
    "rejects an edit after actor %s during geocoding",
    async (action) => {
      const work = await pendingEdit();
      try {
        if (action === "delete")
          await database.database.participant.delete({ where: { id: guestId } });
        else
          await database.database.participant.update({
            where: { id: guestId },
            data: { tokenHash: hashToken("replacement") },
          });
      } finally {
        work.release();
      }
      const response = await work.pending;
      expect(response.statusCode).toBe(403);
      expect(response.json<unknown>()).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await database.database.participant.count({ where: { address: "Prepared address" } })
      ).toBe(0);
    }
  );

  it("rejects stale prepared coordinates when the target location changes", async () => {
    const work = await pendingEdit();
    try {
      await database.database.participant.update({
        where: { id: guestId },
        data: { address: "Concurrent address", lat: 1, lng: 2 },
      });
    } finally {
      work.release();
    }
    const response = await work.pending;
    expect(response.statusCode).toBe(409);
    expect(response.json<unknown>()).toMatchObject({ error: { code: "CONFLICT" } });
    const target = await database.database.participant.findUniqueOrThrow({
      where: { id: guestId },
    });
    expect(target.address).toBe("Concurrent address");
    expect(target.lat?.toNumber()).toBe(1);
    expect(target.lng?.toNumber()).toBe(2);
  });

  it("preserves an unrelated concurrent name edit without repeating Google", async () => {
    const work = await pendingEdit();
    try {
      const rename = await app.inject({
        method: "PATCH",
        url: url(),
        headers: authorization(),
        payload: { name: "Concurrent name" },
      });
      expect(rename.statusCode).toBe(200);
    } finally {
      work.release();
    }
    const response = await work.pending;
    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toMatchObject({
      name: "Concurrent name",
      address: "Prepared address",
      location: { lat: 32.9, lng: -117.2 },
      fuzzyLocation: false,
    });
    expect(provider.requests).toEqual([
      { address: "Prepared address", key: "provider-fixture-key" },
    ]);
  });
});
