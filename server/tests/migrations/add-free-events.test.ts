import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MIGRATION = "20261128120000_add_free_events";
const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));
const EVENT_ID = "evt_1760000000000_abcdefghijklmnop";

const adminUrl = process.env.DATABASE_URL ?? "";
const admin = new PrismaClient({ datasourceUrl: adminUrl });
const databaseName = `w2m_migration_${randomUUID().replaceAll("-", "")}`;
let scratch: PrismaClient;

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function runSql(sql: string): void {
  execFileSync(PRISMA_CLI, ["db", "execute", "--url", databaseUrl(databaseName), "--stdin"], {
    input: sql,
    stdio: ["pipe", "ignore", "pipe"],
  });
}

const migrationSql = (name: string) =>
  readFileSync(`${MIGRATIONS_DIR}${name}/migration.sql`, "utf8");

function insertFreeEvent(kind: string, status = "live") {
  return scratch.$executeRaw`
    INSERT INTO free_event (id, source, source_id, title, starts_at, kind, url, status, updated_at)
    VALUES (${randomUUID()}::uuid, 'nyc-parks', ${randomUUID()}, 'Paint and Sip', now(), ${kind},
      'https://www.nycgovparks.org/events/x', ${status}, now())`;
}

describe(`migration ${MIGRATION}`, () => {
  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    scratch = new PrismaClient({ datasourceUrl: databaseUrl(databaseName) });
    const earlier = readdirSync(MIGRATIONS_DIR)
      .filter((entry) => /^\d{14}_/.test(entry) && entry < MIGRATION)
      .sort();
    runSql(earlier.map(migrationSql).join("\n"));
    await scratch.$executeRaw`
      INSERT INTO event (id, title, updated_at) VALUES (${EVENT_ID}, 'Dinner', now())`;

    runSql(migrationSql(MIGRATION));
  }, 60_000);

  afterAll(async () => {
    await scratch.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.$disconnect();
  }, 60_000);

  it("keeps existing meetings", async () => {
    const events = await scratch.$queryRaw`SELECT id, title FROM event`;
    expect(events).toEqual([{ id: EVENT_ID, title: "Dinner" }]);
  });

  it("stores each kind the API serves", async () => {
    for (const kind of ["free-food", "hackathon", "free-talk"]) {
      await insertFreeEvent(kind);
    }
    const kinds = await scratch.$queryRaw`SELECT kind FROM free_event ORDER BY kind`;
    expect(kinds).toEqual([{ kind: "free-food" }, { kind: "free-talk" }, { kind: "hackathon" }]);
  });

  it("refuses an unknown kind or status", async () => {
    await expect(insertFreeEvent("free_food")).rejects.toThrow(/free_event_kind_check/);
    await expect(insertFreeEvent("hackathon", "deleted")).rejects.toThrow(
      /free_event_status_check/
    );
  });

  it("refuses a second row for the same source event", async () => {
    const insert = () => scratch.$executeRaw`
      INSERT INTO free_event (id, source, source_id, title, starts_at, kind, url, updated_at)
      VALUES (${randomUUID()}::uuid, 'nyc-parks', '2319215', 'Paint and Sip', now(), 'free-food',
        'https://www.nycgovparks.org/events/x', now())`;
    await insert();
    await expect(insert()).rejects.toThrow(/already exists/);
  });
});
