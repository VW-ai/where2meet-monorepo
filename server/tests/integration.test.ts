import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "../src/app.js";
import { importData, ImportConflictError, parseImportData } from "../scripts/import-data.js";
import { createTestDatabase, type TestDatabase } from "./support/database.js";
import {
  fixture,
  eventId,
  participantId,
  guestId,
  userId,
  participantToken,
  guestToken,
  sessionToken,
  expiredSessionToken,
  hashToken,
} from "./support/fixture.js";

const created = z.object({
  id: z.string(),
  participantToken: z.string(),
  organizerParticipantId: z.string(),
});
const authorization = (token = participantToken) => ({ authorization: `Bearer ${token}` });
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const execute = promisify(execFile);
let testDatabase: TestDatabase;
let app: FastifyInstance;
let cleanup: (() => Promise<void>) | undefined;

async function startApp() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for integration tests");
  const instance = await makeApp({
    databaseUrl: testDatabase.databaseUrl,
    redisUrl,
    environment: "test",
    host: "127.0.0.1",
    port: 0,
    logLevel: "silent",
    corsOrigins: ["http://localhost:3001"],
    redisTimeoutMs: 1000,
    heartbeatIntervalMs: 1000,
    streamTimeoutMs: 10000,
  });
  await instance.ready();
  return instance;
}

async function allRows() {
  const database = testDatabase.database;
  const [events, participants, users, userSessions, venues, votes, userIdentities, userEvents] =
    await Promise.all([
      database.event.findMany({ orderBy: { id: "asc" } }),
      database.participant.findMany({ orderBy: { id: "asc" } }),
      database.user.findMany({ orderBy: { id: "asc" } }),
      database.userSession.findMany({ orderBy: { id: "asc" } }),
      database.venue.findMany({ orderBy: { id: "asc" } }),
      database.vote.findMany({ orderBy: { id: "asc" } }),
      database.userIdentity.findMany({ orderBy: { id: "asc" } }),
      database.userEvent.findMany({ orderBy: { id: "asc" } }),
    ]);
  return {
    version: 1,
    events,
    participants,
    users,
    userSessions,
    venues,
    votes,
    userIdentities,
    userEvents,
  };
}

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  cleanup = () => testDatabase.close();
  app = await startApp();
  cleanup = async () => {
    await app.close();
    await testDatabase.close();
  };
});
beforeEach(async () => {
  await testDatabase.reset();
});
afterAll(async () => {
  if (cleanup) await cleanup();
});

it("deploys every immutable migration into a fresh isolated schema", async () => {
  expect(testDatabase.schema).toMatch(/^w2m_test_[0-9a-f]{24}$/);
  const expected = (await readdir(fileURLToPath(new URL("../prisma/migrations/", import.meta.url))))
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
  const applied = await testDatabase.database.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`
    SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
  expect(applied.map((row) => row.migration_name)).toEqual(expected);
  expect(applied.every((row) => row.finished_at !== null && row.rolled_back_at === null)).toBe(
    true
  );
  expect(await testDatabase.database.event.count()).toBe(0);
});

it("logs request method and path without query strings or credential headers", async () => {
  const { stdout } = await execute(
    process.execPath,
    ["--import", "tsx", fileURLToPath(new URL("./support/request-log-probe.ts", import.meta.url))],
    { env: { ...process.env, DATABASE_URL: testDatabase.databaseUrl }, timeout: 10000 }
  );
  expect(stdout).not.toContain("synthetic-query-secret");
  expect(stdout).not.toContain("synthetic-authorization-secret");
  expect(stdout).not.toContain("synthetic-cookie-secret");
  const records = z
    .array(z.object({ req: z.object({ method: z.string(), url: z.string() }).optional() }))
    .parse(
      stdout
        .trim()
        .split("\n")
        .map((line): unknown => JSON.parse(line))
    );
  expect(records.flatMap(({ req }) => (req ? [req] : []))).toEqual([
    { method: "GET", url: "/health" },
  ]);
});

describe("strict, atomic migration import", () => {
  it("preserves all eight models, decimal coordinates, hashes and expiry and retries without changes", async () => {
    const input = fixture();
    const report = await importData(testDatabase.database, input);
    expect(Object.values(report).reduce((sum, count) => sum + count.inserted, 0)).toBe(10);
    const expected = parseImportData(input);
    expected.userSessions.sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = json(await allRows());
    expect(snapshot).toEqual(json(expected));
    const repeated = await importData(testDatabase.database, input);
    expect(Object.values(repeated).every((count) => count.inserted === 0)).toBe(true);
    expect(Object.values(repeated).reduce((sum, count) => sum + count.unchanged, 0)).toBe(10);
    expect(json(await allRows())).toEqual(snapshot);
  });

  it("rejects unknown fields, duplicate IDs and lossy decimals before creating rows", async () => {
    const input = fixture();
    await expect(
      importData(testDatabase.database, { ...input, unexpected: true })
    ).rejects.toThrow();
    await expect(
      importData(testDatabase.database, {
        ...input,
        events: input.events.map((row) => ({ ...row, id: "unreachable_event" })),
      })
    ).rejects.toThrow();
    await expect(
      importData(testDatabase.database, {
        ...input,
        participants: [...input.participants, input.participants[0]],
      })
    ).rejects.toThrow();
    await expect(
      importData(testDatabase.database, {
        ...input,
        venues: input.venues.map((row) => ({ ...row, lat: "32.12345678" })),
      })
    ).rejects.toThrow();
    expect(await testDatabase.database.user.count()).toBe(0);
    expect(await testDatabase.database.event.count()).toBe(0);
  });

  it("rejects conflicting existing rows and rolls back earlier inserts", async () => {
    const input = fixture();
    await importData(testDatabase.database, input);
    const snapshot = json(await allRows());
    const conflict = {
      ...input,
      users: [...input.users, { ...input.users[0], id: "new_user", email: "new@example.test" }],
      venues: input.venues.map((row) => ({ ...row, name: "Conflicting cafe" })),
    };
    await expect(importData(testDatabase.database, conflict)).rejects.toBeInstanceOf(
      ImportConflictError
    );
    expect(json(await allRows())).toEqual(snapshot);
  });

  it("rolls back on a late foreign key failure or cross-meeting vote", async () => {
    const input = fixture();
    await expect(
      importData(testDatabase.database, {
        ...input,
        userEvents: input.userEvents.map((row) => ({
          ...row,
          eventId: "evt_1700000000000_aaaaaaaaaaaaaaaa",
        })),
      })
    ).rejects.toThrow();
    expect(await testDatabase.database.user.count()).toBe(0);
    expect(await testDatabase.database.event.count()).toBe(0);
    const otherEvent = "evt_1700000000000_fedcba9876543210";
    await expect(
      importData(testDatabase.database, {
        ...input,
        events: [...input.events, { ...input.events[0], id: otherEvent }],
        votes: input.votes.map((row) => ({ ...row, eventId: otherEvent })),
      })
    ).rejects.toBeInstanceOf(ImportConflictError);
    expect(await testDatabase.database.vote.count()).toBe(0);
    expect(await testDatabase.database.event.count()).toBe(0);
  });

  it("rejects invalid publication links and mismatched account roles atomically", async () => {
    const input = fixture();
    await expect(
      importData(testDatabase.database, {
        ...input,
        events: input.events.map((row) => ({
          ...row,
          publishedAt: "2026-01-01T00:00:00.000Z",
          publishedVenueId: "missing_place",
        })),
      })
    ).rejects.toBeInstanceOf(ImportConflictError);
    await expect(
      importData(testDatabase.database, {
        ...input,
        userEvents: input.userEvents.map((row) => ({ ...row, role: "participant" })),
      })
    ).rejects.toBeInstanceOf(ImportConflictError);
    expect(await testDatabase.database.user.count()).toBe(0);
  });
});

describe("HTTP contracts against imported PostgreSQL records", () => {
  beforeEach(async () => {
    await importData(testDatabase.database, fixture());
  });

  it("creates an event and organizer, then supports the immediate organizer name PATCH", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: "New meeting", meetingTime: "2027-01-01T10:00:00.000Z" },
    });
    expect(response.statusCode).toBe(201);
    const identity = created.parse(response.json<unknown>());
    expect(identity.participantToken).toMatch(/^pt_[0-9a-f]{64}$/);
    const organizer = await testDatabase.database.participant.findUniqueOrThrow({
      where: { id: identity.organizerParticipantId },
    });
    expect(organizer).toMatchObject({
      eventId: identity.id,
      name: "Organizer",
      isOrganizer: true,
      lat: null,
      lng: null,
      tokenHash: hashToken(identity.participantToken),
    });
    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/events/${identity.id}/participants/${identity.organizerParticipantId}`,
      headers: authorization(identity.participantToken),
      payload: { name: "Wayne" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<unknown>()).toMatchObject({
      id: identity.organizerParticipantId,
      name: "Wayne",
      location: null,
      isOrganizer: true,
    });
    expect(
      (
        await testDatabase.database.event.findUniqueOrThrow({ where: { id: identity.id } })
      ).meetingTime?.toISOString()
    ).toBe("2027-01-01T10:00:00.000Z");
  });

  it("rolls back the event when PostgreSQL rejects organizer insertion", async () => {
    const database = testDatabase.database;
    const count = await database.event.count();
    await database.$executeRawUnsafe(
      `CREATE FUNCTION reject_test_participant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'integration fault'; END $$`
    );
    await database.$executeRawUnsafe(
      "CREATE TRIGGER reject_test_participant BEFORE INSERT ON participant FOR EACH ROW EXECUTE FUNCTION reject_test_participant()"
    );
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/events",
        payload: { title: "Must roll back" },
      });
      expect(response.statusCode).toBe(500);
      expect(await database.event.count()).toBe(count);
      expect(await database.event.count({ where: { title: "Must roll back" } })).toBe(0);
    } finally {
      await database.$executeRawUnsafe("DROP TRIGGER reject_test_participant ON participant");
      await database.$executeRawUnsafe("DROP FUNCTION reject_test_participant()");
    }
  });

  it("reads imported participants and returns the actual /me shape without secrets", async () => {
    const response = await app.inject(`/api/events/${eventId}`);
    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toMatchObject({
      id: eventId,
      title: "Imported meeting",
      settings: { allowParticipantsAfterPublish: false },
    });
    expect(
      z.object({ participants: z.array(z.unknown()) }).parse(response.json<unknown>()).participants
    ).toContainEqual({
      id: guestId,
      name: "Original guest",
      address: null,
      location: { lat: 32.1234567, lng: -117.1234567 },
      fuzzyLocation: true,
      color: "mint",
      isOrganizer: false,
    });
    const me = await app.inject({
      url: `/api/events/${eventId}/me`,
      headers: authorization(guestToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<unknown>()).toEqual({
      participantId: guestId,
      name: "Original guest",
      isOrganizer: false,
      color: "mint",
      address: "Example address",
      lat: 32.1234567,
      lng: -117.1234567,
    });
    expect(response.body).not.toContain("tokenHash");
    expect(response.body).not.toContain(participantToken);
  });

  it("denies missing, incorrect, cross-meeting and non-organizer credentials", async () => {
    const missing = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}`,
      payload: { title: "Denied" },
    });
    expect(missing.statusCode).toBe(401);
    const invalid = await app.inject({
      url: `/api/events/${eventId}/me`,
      headers: authorization("invalid"),
    });
    expect(invalid.statusCode).toBe(403);
    const denied = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}`,
      headers: authorization(guestToken),
      payload: { title: "Denied" },
    });
    expect(denied.statusCode).toBe(403);
    const other = created.parse(
      (
        await app.inject({ method: "POST", url: "/api/events", payload: { title: "Other" } })
      ).json<unknown>()
    );
    const cross = await app.inject({ url: `/api/events/${other.id}/me`, headers: authorization() });
    expect(cross.statusCode).toBe(403);
    const renameOther = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}/participants/${participantId}`,
      headers: authorization(guestToken),
      payload: { name: "Denied" },
    });
    expect(renameOther.statusCode).toBe(403);
    const crossTarget = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}/participants/${other.organizerParticipantId}`,
      headers: authorization(),
      payload: { name: "Denied" },
    });
    expect(crossTarget.statusCode).toBe(404);
    expect(
      (await testDatabase.database.event.findUniqueOrThrow({ where: { id: eventId } })).title
    ).toBe("Imported meeting");
  });

  it("allows self rename while open, locks names after publication, and still permits organizer event edits", async () => {
    const own = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}/participants/${guestId}`,
      headers: authorization(guestToken),
      payload: { name: "New guest" },
    });
    expect(own.statusCode).toBe(200);
    await testDatabase.database.event.update({
      where: { id: eventId },
      data: {
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        publishedVenueId: "fixture_place",
      },
    });
    const locked = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}/participants/${participantId}`,
      headers: authorization(),
      payload: { name: "Locked change" },
    });
    expect(locked.statusCode).toBe(409);
    expect(locked.json<unknown>()).toMatchObject({ error: { code: "EVENT_ALREADY_PUBLISHED" } });
    const update = await app.inject({
      method: "PATCH",
      url: `/api/events/${eventId}`,
      headers: authorization(),
      payload: { title: "Published title", meetingTime: null },
    });
    expect(update.statusCode).toBe(200);
    expect(
      (await testDatabase.database.event.findUniqueOrThrow({ where: { id: eventId } })).title
    ).toBe("Published title");
    expect(
      (await testDatabase.database.participant.findUniqueOrThrow({ where: { id: participantId } }))
        .name
    ).toBe("Original organizer");
  });

  it("reads populated votes with real venue fields and participant IDs, then represents zero votes truthfully", async () => {
    const response = await app.inject(`/api/events/${eventId}/votes`);
    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toEqual({
      venues: [
        {
          id: "fixture_place",
          name: "Existing cafe",
          address: "Cafe address",
          location: { lat: 32.2345678, lng: -117.2345678 },
          category: "cafe",
          rating: 4.5,
          priceLevel: 2,
          photoUrl: null,
          voteCount: 1,
          voters: [guestId],
        },
      ],
      totalVotes: 1,
    });
    await testDatabase.database.vote.deleteMany({ where: { eventId } });
    expect((await app.inject(`/api/events/${eventId}/votes`)).json<unknown>()).toEqual({
      venues: [],
      totalVotes: 0,
    });
  });

  it("deletes meeting-owned rows but retains the global venue and account", async () => {
    const denied = await app.inject({
      method: "DELETE",
      url: `/api/events/${eventId}`,
      headers: authorization(guestToken),
    });
    expect(denied.statusCode).toBe(403);
    const response = await app.inject({
      method: "DELETE",
      url: `/api/events/${eventId}`,
      headers: authorization(),
    });
    expect(response.statusCode).toBe(200);
    const database = testDatabase.database;
    expect(await database.event.count()).toBe(0);
    expect(await database.participant.count()).toBe(0);
    expect(await database.vote.count()).toBe(0);
    expect(await database.userEvent.count()).toBe(0);
    expect(await database.venue.count()).toBe(1);
    expect(await database.user.count()).toBe(1);
    expect(await database.userSession.count()).toBe(2);
    expect((await app.inject(`/api/events/${eventId}`)).statusCode).toBe(404);
  });

  it("accepts an imported session cookie without extending expiry and rejects expired sessions", async () => {
    const headers = { cookie: `session_token=${sessionToken}` };
    const before = await testDatabase.database.userSession.findUniqueOrThrow({
      where: { tokenHash: hashToken(sessionToken) },
    });
    const response = await app.inject({ url: "/api/auth/session", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toEqual({ user: fixture().users[0] });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect((await app.inject({ url: "/api/auth/session", headers })).statusCode).toBe(200);
    const after = await testDatabase.database.userSession.findUniqueOrThrow({
      where: { tokenHash: hashToken(sessionToken) },
    });
    expect(after).toEqual(before);
    expect((await app.inject("/api/auth/session")).statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/api/auth/session", headers: { cookie: "session_token=invalid" } }))
        .statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: "/api/auth/session",
          headers: { cookie: `session_token=${expiredSessionToken}` },
        })
      ).statusCode
    ).toBe(401);
  });

  it("retains imported identity and session across an application restart", async () => {
    await app.close();
    app = await startApp();
    const me = await app.inject({ url: `/api/events/${eventId}/me`, headers: authorization() });
    expect(me.statusCode).toBe(200);
    expect(me.json<unknown>()).toMatchObject({ participantId, name: "Original organizer" });
    expect(
      (
        await app.inject({
          url: "/api/auth/session",
          headers: { cookie: `session_token=${sessionToken}` },
        })
      ).json<unknown>()
    ).toMatchObject({ user: { id: userId } });
  });

  it("returns explicit unsupported errors and leaves data unchanged", async () => {
    const snapshot = json(await allRows());
    const voting = await app.inject({
      method: "POST",
      url: `/api/events/${eventId}/participants/${participantId}/votes`,
      headers: authorization(),
      payload: { venueId: "fixture_place" },
    });
    expect(voting.statusCode).toBe(501);
    expect(voting.json<unknown>()).toMatchObject({ error: { code: "FEATURE_NOT_AVAILABLE" } });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/events/${eventId}/publish`,
          headers: authorization(),
          payload: { venueId: "fixture_place" },
        })
      ).statusCode
    ).toBe(501);
    expect((await app.inject("/api/unknown")).statusCode).toBe(404);
    expect(json(await allRows())).toEqual(snapshot);
  });

  it("commits edits during a notification outage and reports degraded readiness", async () => {
    const reserved = createServer();
    await new Promise<void>((resolve, reject) => {
      reserved.once("error", reject);
      reserved.listen(0, "127.0.0.1", resolve);
    });
    const address = reserved.address();
    if (!address || typeof address === "string") throw new Error("Missing reserved test port");
    await new Promise<void>((resolve, reject) =>
      reserved.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
    const degraded = await makeApp({
      databaseUrl: testDatabase.databaseUrl,
      redisUrl: `redis://127.0.0.1:${String(address.port)}`,
      environment: "test",
      logLevel: "silent",
      corsOrigins: ["http://localhost:3001"],
      redisTimeoutMs: 100,
    });
    try {
      const changed = await degraded.inject({
        method: "PATCH",
        url: `/api/events/${eventId}`,
        headers: authorization(),
        payload: { title: "Saved during Redis outage" },
      });
      expect(changed.statusCode).toBe(200);
      expect(
        (await testDatabase.database.event.findUniqueOrThrow({ where: { id: eventId } })).title
      ).toBe("Saved during Redis outage");
      const readiness = await degraded.inject("/health/ready");
      expect(readiness.statusCode).toBe(200);
      expect(readiness.json<unknown>()).toMatchObject({
        status: "degraded",
        services: { database: "ok", redis: "unhealthy" },
      });
    } finally {
      await degraded.close();
    }
  });

  it("authenticates a real SSE socket and sends initial heartbeat plus the committed nested event update", async () => {
    expect((await app.inject(`/api/events/${eventId}/stream`)).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: `/api/events/${eventId}/stream`,
          headers: authorization("invalid"),
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: `/api/events/${eventId}/stream`,
          headers: { ...authorization(), origin: "http://untrusted.test" },
        })
      ).statusCode
    ).toBe(403);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      abort.abort();
    }, 8000);
    try {
      const stream = await fetch(`${address}/api/events/${eventId}/stream`, {
        headers: { ...authorization(), origin: "http://localhost:3001" },
        signal: abort.signal,
      });
      expect(stream.status).toBe(200);
      expect(stream.headers.get("content-type")).toContain("text/event-stream");
      expect(stream.headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
      const reader = stream.body?.getReader();
      if (!reader) throw new Error("Missing stream body");
      const decoder = new TextDecoder();
      let frames = "";
      while (!frames.includes("event: heartbeat\n")) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("Stream ended before heartbeat");
        frames += decoder.decode(z.instanceof(Uint8Array).parse(chunk.value), { stream: true });
      }
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: `/api/events/${eventId}`,
            headers: authorization(),
            payload: { title: "Stream update" },
          })
        ).statusCode
      ).toBe(200);
      while (!frames.includes("event: event:updated\n")) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("Stream ended before committed update");
        frames += decoder.decode(z.instanceof(Uint8Array).parse(chunk.value), { stream: true });
      }
      const updated = frames
        .split("\n\n")
        .find((entry) => entry.startsWith("event: event:updated\n"));
      expect(updated).toBe(
        `event: event:updated\ndata: ${JSON.stringify({ event: { id: eventId, title: "Stream update", meetingTime: null, publishedAt: null, publishedVenueId: null } })}`
      );
      expect(
        (await testDatabase.database.event.findUniqueOrThrow({ where: { id: eventId } })).title
      ).toBe("Stream update");
      await reader.cancel();
    } finally {
      clearTimeout(timeout);
      abort.abort();
    }
  });
});
