import { randomInt, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "../src/app.js";
import { importData } from "../scripts/import-data.js";
import { createTestDatabase, type TestDatabase } from "./support/database.js";
import { deferred } from "./support/geocoder.js";
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

const profile = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    emailVerified: z.boolean(),
    defaultAddress: z.string().nullable(),
    defaultPlaceId: z.string().nullable(),
    defaultFuzzyLocation: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const claimResult = z
  .object({
    success: z.literal(true),
    userEvent: z
      .object({
        id: z.string(),
        eventId: z.string(),
        participantId: z.string().nullable(),
        role: z.enum(["organizer", "participant"]),
        createdAt: z.string(),
      })
      .strict(),
  })
  .strict();
const password = "Synthetic-password-123";
const cookie = (credential = sessionToken) => `session_token=${credential}`;
let database: TestDatabase;
let app: FastifyInstance;
let address: string;
const cleanups: (() => Promise<void>)[] = [];

async function startApp(environment: "test" | "production" = "test") {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for integration tests");
  const instance = await makeApp({
    databaseUrl: database.databaseUrl,
    redisUrl,
    environment,
    logLevel: "silent",
    corsOrigins: ["http://localhost:3001"],
    rateLimitMax: 1000,
    redisTimeoutMs: 1000,
  });
  return { app: instance, address: await instance.listen({ host: "127.0.0.1", port: 0 }) };
}

async function request(
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string; authorization?: string; origin?: string } = {}
) {
  const response = await fetch(`${options.origin ?? address}${path}`, {
    method,
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.authorization ? { Authorization: options.authorization } : {}),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body, setCookie: response.headers.get("set-cookie") };
}

function credentialFrom(setCookie: string | null) {
  const value = setCookie?.match(/^session_token=(st_[0-9a-f]{64});/)?.[1];
  if (!value) throw new Error("Expected a session cookie");
  return value;
}

async function register(email = "person@example.test", suppliedPassword = password) {
  const result = await request("POST", "/api/auth/register", {
    body: { email, password: suppliedPassword },
  });
  expect(result.status).toBe(201);
  const user = z.object({ user: profile }).strict().parse(result.body).user;
  const credential = credentialFrom(result.setCookie);
  return { result, user, credential, cookie: cookie(credential) };
}

async function claim(credential = participantToken, accountCookie = cookie(), id = eventId) {
  return request("POST", "/api/users/me/events/claim", {
    cookie: accountCookie,
    body: { eventId: id, participantToken: credential },
  });
}

beforeAll(async () => {
  database = await createTestDatabase();
  cleanups.push(() => database.close());
  ({ app, address } = await startApp());
  cleanups.push(() => app.close());
});
beforeEach(async () => {
  await database.reset();
});
afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

describe("accounts through HTTP and PostgreSQL", () => {
  it("registers a normalized profile and stores one bcrypt identity and a seven-day hashed session", async () => {
    const before = Date.now();
    const account = await register("Person@Example.TEST");
    expect(account.user).toEqual({
      id: account.user.id,
      email: "person@example.test",
      name: null,
      avatarUrl: null,
      emailVerified: false,
      defaultAddress: null,
      defaultPlaceId: null,
      defaultFuzzyLocation: false,
      createdAt: account.user.createdAt,
      updatedAt: account.user.updatedAt,
    });
    expect(account.user.id).toMatch(/^usr_[0-9a-f]{32}$/);
    expect(Date.parse(account.user.createdAt)).toBeGreaterThanOrEqual(before);
    expect(account.result.setCookie).toContain("Max-Age=604800");
    expect(account.result.setCookie).toContain("HttpOnly");
    expect(account.result.setCookie).toContain("SameSite=Lax");
    expect(account.result.setCookie).toContain("Path=/");
    expect(account.result.setCookie).not.toContain("Secure");
    const identities = await database.database.userIdentity.findMany();
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      userId: account.user.id,
      provider: "email",
      providerId: "person@example.test",
    });
    expect(identities[0]?.id).toMatch(/^ident_[0-9a-f]{32}$/);
    expect(identities[0]?.passwordHash).toMatch(/^\$2b\$12\$[./A-Za-z0-9]{53}$/);
    const sessions = await database.database.userSession.findMany();
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    if (!session) throw new Error("Missing session");
    expect(session.id).toMatch(/^ses_[0-9a-f]{32}$/);
    expect(session.tokenHash).toBe(hashToken(account.credential));
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 604800000);
    const found = await request("GET", "/api/auth/session", { cookie: account.cookie });
    expect(found).toEqual({ status: 200, body: { user: account.user }, setCookie: null });
    expect((await request("GET", "/api/users/me", { cookie: account.cookie })).body).toEqual(
      account.user
    );
    expect((await request("GET", "/api/users/me/events", { cookie: account.cookie })).body).toEqual(
      { events: [] }
    );
    expect(await database.database.userSession.findMany()).toEqual(sessions);
  });

  it("preserves Secure cookies in production and clears them with matching attributes", async () => {
    const production = await startApp("production");
    try {
      const created = await request("POST", "/api/auth/register", {
        origin: production.address,
        body: { email: "secure@example.test", password },
      });
      expect(created.status).toBe(201);
      expect(created.setCookie).toContain("Secure");
      const loggedOut = await request("POST", "/api/auth/logout", {
        origin: production.address,
        cookie: cookie(credentialFrom(created.setCookie)),
      });
      expect(loggedOut.status).toBe(200);
      expect(loggedOut.setCookie).toBe(
        "session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
      );
    } finally {
      await production.app.close();
    }
  });

  it.each([
    { email: "not-email", password },
    { email: "space@example.test ", password },
    { email: "a@example.test", password: "short" },
    { email: "a@example.test", password, name: "a".repeat(256) },
  ])("rejects invalid registration without writing any account rows: %j", async (body) => {
    expect((await request("POST", "/api/auth/register", { body })).body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid request" },
    });
    expect(await database.database.user.count()).toBe(0);
    expect(await database.database.userIdentity.count()).toBe(0);
    expect(await database.database.userSession.count()).toBe(0);
  });

  it("returns EMAIL_EXISTS under concurrent normalized-email registration without partial accounts", async () => {
    const results = await Promise.all(
      ["race@example.test", "RACE@EXAMPLE.TEST"].map((email) =>
        request("POST", "/api/auth/register", { body: { email, password } })
      )
    );
    expect(results.map((entry) => entry.status).sort()).toEqual([201, 409]);
    expect(results.find((entry) => entry.status === 409)).toMatchObject({
      body: { error: { code: "EMAIL_EXISTS", message: "Email is already registered" } },
      setCookie: null,
    });
    expect(await database.database.user.count()).toBe(1);
    expect(await database.database.userIdentity.count()).toBe(1);
    expect(await database.database.userSession.count()).toBe(1);
    expect(
      (
        await request("POST", "/api/auth/register", {
          body: { email: "race@example.test", password },
        })
      ).status
    ).toBe(409);
  });

  it("rolls back registration when the final session write fails", async () => {
    await database.database.$executeRawUnsafe(
      `CREATE FUNCTION fail_session_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic session write failure'; END; $$`
    );
    await database.database.$executeRawUnsafe(
      `CREATE TRIGGER fail_session_write BEFORE INSERT ON user_session FOR EACH ROW EXECUTE FUNCTION fail_session_write()`
    );
    try {
      const result = await request("POST", "/api/auth/register", {
        body: { email: "rollback@example.test", password },
      });
      expect(result).toEqual({
        status: 500,
        body: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
        setCookie: null,
      });
      expect(await database.database.user.count()).toBe(0);
      expect(await database.database.userIdentity.count()).toBe(0);
      expect(await database.database.userSession.count()).toBe(0);
    } finally {
      await database.database.$executeRawUnsafe("DROP TRIGGER fail_session_write ON user_session");
      await database.database.$executeRawUnsafe("DROP FUNCTION fail_session_write()");
    }
  });

  it("logs in case-insensitively, rejects bad credentials, and logs out only the presented session", async () => {
    const account = await register();
    for (const input of [
      { email: "person@example.test", password: "wrong" },
      { email: "missing@example.test", password },
    ]) {
      const result = await request("POST", "/api/auth/login", { body: input });
      expect(result).toEqual({
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        setCookie: null,
      });
    }
    const login = await request("POST", "/api/auth/login", {
      body: { email: "PERSON@EXAMPLE.TEST", password },
    });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ user: account.user });
    const second = credentialFrom(login.setCookie);
    expect(second).not.toBe(account.credential);
    expect(await database.database.userSession.count()).toBe(2);
    const out = await request("POST", "/api/auth/logout", { cookie: account.cookie });
    expect(out).toEqual({
      status: 200,
      body: { success: true },
      setCookie: "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    });
    expect((await request("GET", "/api/auth/session", { cookie: account.cookie })).status).toBe(
      401
    );
    expect((await request("GET", "/api/auth/session", { cookie: cookie(second) })).status).toBe(
      200
    );
    expect(await database.database.userSession.count()).toBe(1);
    for (const optionalCookie of [undefined, account.cookie, "session_token=missing"]) {
      expect((await request("POST", "/api/auth/logout", { cookie: optionalCookie })).body).toEqual({
        success: true,
      });
    }
    expect(await database.database.userSession.count()).toBe(1);
  });

  it("keeps legacy bcrypt byte-limit behavior without adding a new password maximum", async () => {
    const prefix = "é".repeat(36);
    await register("long@example.test", `${prefix}one`);
    expect(
      (
        await request("POST", "/api/auth/login", {
          body: { email: "long@example.test", password: `${prefix}two` },
        })
      ).status
    ).toBe(200);
  });

  it("authenticates an imported public native-bcrypt vector after restart without rewriting imported records", async () => {
    const data = fixture();
    const identity = data.userIdentities[0];
    if (!identity) throw new Error("Missing fixture identity");
    // Public interoperability vector from https://github.com/kelektiv/node.bcrypt.js/blob/master/test/async.test.js.
    identity.passwordHash = "$2a$10$XOPbrlUPQdwdJUpSrIF6X.LbE14qsMmKGhM1A8W9iqaG3vv1BD7WC";
    await importData(database.database, data);
    const originalIdentity = await database.database.userIdentity.findMany();
    const originalSessions = await database.database.userSession.findMany({
      orderBy: { id: "asc" },
    });
    await app.close();
    ({ app, address } = await startApp());
    const login = await request("POST", "/api/auth/login", {
      body: { email: "fixture@example.test", password: "envy1362987212538" },
    });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ user: data.users[0] });
    expect(await database.database.userIdentity.findMany()).toEqual(originalIdentity);
    for (const original of originalSessions)
      expect(
        await database.database.userSession.findUnique({ where: { id: original.id } })
      ).toEqual(original);
    expect((await request("GET", "/api/auth/session", { cookie: cookie() })).status).toBe(200);
    expect(await database.database.userSession.count()).toBe(3);
    const expired = await Promise.all(
      [0, 1].map(() => request("GET", "/api/auth/session", { cookie: cookie(expiredSessionToken) }))
    );
    expect(expired.map((entry) => entry.status)).toEqual([401, 401]);
    expect(await database.database.userSession.count()).toBe(2);
  });

  it("does not turn a failed logout write into success or clear the cookie", async () => {
    const account = await register();
    await database.database.$executeRawUnsafe(
      `CREATE FUNCTION fail_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic revocation failure'; END; $$`
    );
    await database.database.$executeRawUnsafe(
      `CREATE TRIGGER fail_session_delete BEFORE DELETE ON user_session FOR EACH ROW EXECUTE FUNCTION fail_session_delete()`
    );
    try {
      const result = await request("POST", "/api/auth/logout", { cookie: account.cookie });
      expect(result).toEqual({
        status: 500,
        body: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
        setCookie: null,
      });
      expect((await request("GET", "/api/auth/session", { cookie: account.cookie })).status).toBe(
        200
      );
    } finally {
      await database.database.$executeRawUnsafe("DROP TRIGGER fail_session_delete ON user_session");
      await database.database.$executeRawUnsafe("DROP FUNCTION fail_session_delete()");
    }
  });

  it.each([null, "not-bcrypt", "!".repeat(60)])(
    "rejects unusable imported password hash case %# without rewriting it",
    async (passwordHash) => {
      const data = fixture();
      await importData(database.database, {
        ...data,
        userIdentities: data.userIdentities.map((row) => ({ ...row, passwordHash })),
      });
      const before = await database.database.userIdentity.findMany();
      const result = await request("POST", "/api/auth/login", {
        body: { email: "fixture@example.test", password },
      });
      expect(result).toEqual({
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        setCookie: null,
      });
      expect(await database.database.userIdentity.findMany()).toEqual(before);
      expect(await database.database.userSession.count()).toBe(2);
    }
  );

  it("updates only the authenticated profile and distinguishes omitted fields from explicit null", async () => {
    const account = await register();
    const patch = {
      name: "Saved name",
      avatarUrl: "https://example.test/avatar.png",
      defaultAddress: "Private default address",
      defaultPlaceId: "place_saved",
      defaultFuzzyLocation: true,
    };
    const saved = await request("PATCH", "/api/users/me", {
      cookie: account.cookie,
      body: {
        ...patch,
        email: "ignored@example.test",
        userId: "someone-else",
        emailVerified: true,
      },
    });
    expect(saved.status).toBe(200);
    const updated = profile.parse(saved.body);
    expect(updated).toEqual({ ...account.user, ...patch, updatedAt: updated.updatedAt });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(account.user.updatedAt)
    );
    const cleared = await request("PATCH", "/api/users/me", {
      cookie: account.cookie,
      body: { name: null, avatarUrl: null, defaultAddress: null, defaultPlaceId: null },
    });
    expect(cleared.status).toBe(200);
    const clearedProfile = profile.parse(cleared.body);
    expect(cleared.body).toEqual({
      ...updated,
      name: null,
      avatarUrl: null,
      defaultAddress: null,
      defaultPlaceId: null,
      updatedAt: clearedProfile.updatedAt,
    });
    expect((await request("GET", "/api/auth/session", { cookie: account.cookie })).body).toEqual({
      user: cleared.body,
    });
    expect(await database.database.userEvent.count()).toBe(0);
    expect(await database.database.participant.count()).toBe(0);
  });

  it.each([
    {},
    { email: "uneditable@example.test" },
    { name: "a".repeat(256) },
    { avatarUrl: "bad-url" },
    { defaultFuzzyLocation: null },
  ])("validates profile patches after session auth: %j", async (body) => {
    const unauthorized = await request("PATCH", "/api/users/me", { body });
    expect(unauthorized).toEqual({
      status: 401,
      body: { error: { code: "UNAUTHORIZED", message: "Session required" } },
      setCookie: null,
    });
    await importData(database.database, fixture());
    expect((await request("PATCH", "/api/users/me", { cookie: cookie(), body })).status).toBe(400);
    expect(
      (await request("PATCH", "/api/users/me", { cookie: cookie(expiredSessionToken), body }))
        .status
    ).toBe(401);
    expect((await request("GET", "/api/users/me", { cookie: cookie() })).body).toEqual(
      fixture().users[0]
    );
  });
});

describe("account claims through HTTP and PostgreSQL", () => {
  beforeEach(async () => {
    await importData(database.database, fixture());
  });

  it("returns the narrow dashboard envelope and repeats a claim with the original ID and date", async () => {
    const initial = fixture().userEvents[0];
    const event = fixture().events[0];
    if (!initial || !event) throw new Error("Missing fixture claim or event");
    const expected = {
      success: true,
      userEvent: {
        id: initial.id,
        role: "organizer",
        participantId,
        eventId,
        createdAt: initial.createdAt,
      },
    };
    const repeated = await Promise.all([claim(), claim()]);
    for (const response of repeated)
      expect(response).toEqual({ status: 201, body: expected, setCookie: null });
    expect(await database.database.userEvent.count()).toBe(1);
    const events = await request("GET", "/api/users/me/events", { cookie: cookie() });
    expect(events.body).toEqual({
      events: [
        {
          id: initial.id,
          role: "organizer",
          participantId,
          createdAt: initial.createdAt,
          event: {
            id: eventId,
            title: event.title,
            meetingTime: event.meetingTime,
            publishedAt: null,
            createdAt: event.createdAt,
            participantCount: 2,
            participants: fixture().participants.map(({ id, name, color, isOrganizer }) => ({
              id,
              name,
              color,
              isOrganizer,
            })),
          },
        },
      ],
    });
    const other = await register("other@example.test");
    expect((await request("GET", "/api/users/me/events", { cookie: other.cookie })).body).toEqual({
      events: [],
    });
  });

  it("rebinds the same account to a different valid token without changing credentials, ID or creation time", async () => {
    const before = await database.database.participant.findMany({ orderBy: { id: "asc" } });
    const original = claimResult.parse((await claim()).body).userEvent;
    const guest = await claim(guestToken);
    expect(guest.status).toBe(201);
    expect(guest.body).toEqual({
      success: true,
      userEvent: { ...original, participantId: guestId, role: "participant" },
    });
    expect((await claim()).body).toEqual({ success: true, userEvent: original });
    expect(await database.database.participant.findMany({ orderBy: { id: "asc" } })).toEqual(
      before
    );
    expect(await database.database.userEvent.count()).toBe(1);
  });

  it("allows published-event claims and permits exactly one account to claim a participant", async () => {
    const other = await register("other@example.test");
    const denied = await claim(participantToken, other.cookie);
    expect(denied).toEqual({
      status: 409,
      body: { error: { code: "CONFLICT", message: "Participant is already claimed" } },
      setCookie: null,
    });
    await database.database.event.update({
      where: { id: eventId },
      data: { publishedAt: new Date(), publishedVenueId: "fixture_place" },
    });
    const granted = await claim(guestToken, other.cookie);
    expect(granted.status).toBe(201);
    expect(claimResult.parse(granted.body).userEvent).toMatchObject({
      role: "participant",
      participantId: guestId,
    });
    expect(await database.database.userEvent.count()).toBe(2);
    expect((await claim(guestToken)).status).toBe(409);
  });

  it("settles concurrent competing claims with one winner and no ownership transfer", async () => {
    await database.database.userEvent.deleteMany();
    const other = await register("other@example.test");
    const results = await Promise.all([
      claim(participantToken),
      claim(participantToken, other.cookie),
    ]);
    expect(results.map((entry) => entry.status).sort()).toEqual([201, 409]);
    const links = await database.database.userEvent.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]?.participantId).toBe(participantId);
    expect(links[0]?.role).toBe("organizer");
    const winner = results[0].status === 201 ? userId : other.user.id;
    expect(links[0]?.userId).toBe(winner);
  });

  it("rejects malformed, foreign, missing and tokenless identities after session authentication", async () => {
    const invalid = { eventId: "bad", participantToken: "bad" };
    expect((await request("POST", "/api/users/me/events/claim", { body: invalid })).status).toBe(
      401
    );
    expect(
      (await request("POST", "/api/users/me/events/claim", { cookie: cookie(), body: invalid }))
        .status
    ).toBe(400);
    expect((await claim(`pt_${"f".repeat(64)}`)).body).toEqual({
      error: { code: "FORBIDDEN", message: "Invalid participant token" },
    });
    expect(
      (await claim(participantToken, cookie(), "evt_1700000000000_aaaaaaaaaaaaaaaa")).status
    ).toBe(404);
    const created = await request("POST", "/api/events", { body: { title: "Other meeting" } });
    const another = z.object({ id: z.string() }).parse(created.body);
    expect((await claim(participantToken, cookie(), another.id)).status).toBe(403);
    await database.database.participant.update({
      where: { id: guestId },
      data: { tokenHash: null },
    });
    expect((await claim(guestToken)).status).toBe(403);
    expect(await database.database.userEvent.count()).toBe(1);
  });

  it("retains detached claims, reattaches with a new token, and removes claims when the event is deleted", async () => {
    const original = claimResult.parse((await claim(guestToken)).body).userEvent;
    expect(
      (
        await request("DELETE", `/api/events/${eventId}/participants/${guestId}`, {
          authorization: `Bearer ${guestToken}`,
        })
      ).status
    ).toBe(200);
    const listing = await request("GET", "/api/users/me/events", { cookie: cookie() });
    expect(
      z
        .object({
          events: z.array(z.object({ participantId: z.null(), role: z.literal("participant") })),
        })
        .parse(listing.body).events
    ).toHaveLength(1);
    const freshId = randomUUID();
    const freshToken = `pt_${"e".repeat(64)}`;
    await database.database.participant.create({
      data: {
        id: freshId,
        eventId,
        name: "Returned guest",
        color: "mint",
        tokenHash: hashToken(freshToken),
      },
    });
    expect((await claim(freshToken)).body).toEqual({
      success: true,
      userEvent: { ...original, participantId: freshId },
    });
    expect(
      (
        await request("DELETE", `/api/events/${eventId}`, {
          authorization: `Bearer ${participantToken}`,
        })
      ).status
    ).toBe(200);
    expect((await request("GET", "/api/users/me/events", { cookie: cookie() })).body).toEqual({
      events: [],
    });
    expect(await database.database.user.count()).toBe(1);
    expect(await database.database.userSession.count()).toBe(2);
  });

  it("does not grant meeting edits, identity or SSE access from a claimed account cookie", async () => {
    expect((await claim()).status).toBe(201);
    for (const path of [`/api/events/${eventId}/me`, `/api/events/${eventId}/stream`]) {
      expect((await request("GET", path, { cookie: cookie() })).status).toBe(401);
    }
    expect(
      (
        await request("PATCH", `/api/events/${eventId}`, {
          cookie: cookie(),
          body: { title: "Not allowed" },
        })
      ).status
    ).toBe(401);
    expect(
      (
        await request("GET", `/api/events/${eventId}/me`, {
          authorization: `Bearer ${participantToken}`,
        })
      ).status
    ).toBe(200);
  });

  it.each(["participant", "event"] as const)(
    "maps a %s deletion after claim validation to a safe conflict",
    async (target) => {
      await database.database.userEvent.deleteMany();
      const key = randomInt(1, 2147483647);
      await database.database.$executeRawUnsafe(
        `CREATE FUNCTION block_claim_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${String(key)}); RETURN NEW; END; $$`
      );
      await database.database.$executeRawUnsafe(
        "CREATE TRIGGER block_claim_insert BEFORE INSERT ON user_event FOR EACH ROW EXECUTE FUNCTION block_claim_insert()"
      );
      const locked = deferred();
      const release = deferred();
      const hold = database.database.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
          locked.resolve();
          await release.promise;
        },
        { timeout: 10000 }
      );
      let pending: ReturnType<typeof claim> | undefined;
      try {
        await locked.promise;
        pending = claim();
        await expect
          .poll(
            async () => {
              const rows = await database.database.$queryRaw<
                { waiting: bigint }[]
              >`SELECT count(*) AS waiting FROM pg_locks WHERE locktype = 'advisory' AND objid = ${key} AND NOT granted`;
              return Number(rows[0]?.waiting ?? 0);
            },
            { timeout: 5000 }
          )
          .toBe(1);
        if (target === "participant")
          await database.database.participant.delete({ where: { id: participantId } });
        else await database.database.event.delete({ where: { id: eventId } });
        release.resolve();
        await hold;
        const result = await pending;
        expect([403, 404, 409]).toContain(result.status);
        expect(
          z
            .object({
              error: z.object({
                code: z.enum(["FORBIDDEN", "EVENT_NOT_FOUND", "CONFLICT"]),
                message: z.string(),
              }),
            })
            .parse(result.body).error.message
        ).not.toContain("Prisma");
        expect(await database.database.userEvent.count()).toBe(0);
      } finally {
        release.resolve();
        await hold;
        if (pending) await pending;
        await database.database.$executeRawUnsafe("DROP TRIGGER block_claim_insert ON user_event");
        await database.database.$executeRawUnsafe("DROP FUNCTION block_claim_insert()");
      }
    }
  );
});
