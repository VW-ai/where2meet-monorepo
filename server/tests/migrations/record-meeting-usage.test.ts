import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MIGRATION = "20261020120000_record_meeting_visits_and_venue_searches";
const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));
const SCHEMA = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));
const PANEL_ROLE = "control_usage";

const EVENT_ID = "evt_1760000000000_abcdefghijklmnop";
const PARTICIPANT_ID = "00000000-0000-4000-8000-000000000001";

const adminUrl = process.env.DATABASE_URL ?? "";
const admin = new PrismaClient({ datasourceUrl: adminUrl });
const databases: string[] = [];

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function runSql(url: string, sql: string): void {
  execFileSync(PRISMA_CLI, ["db", "execute", "--url", url, "--stdin"], {
    input: sql,
    stdio: ["pipe", "ignore", "pipe"],
  });
}

function migrationSql(name: string): string {
  return readFileSync(`${MIGRATIONS_DIR}${name}/migration.sql`, "utf8");
}

/**
 * Drops the panel role. DROP ROLE fails while any database still grants it something, such as
 * a scratch database a killed run left, so revoke those first.
 */
async function dropPanelRole(): Promise<void> {
  const holders = await admin.$queryRaw<{ datname: string }[]>`
    SELECT DISTINCT d.datname FROM pg_shdepend s JOIN pg_database d ON d.oid = s.dbid
    WHERE s.refclassid = 'pg_authid'::regclass
      AND s.refobjid = (SELECT oid FROM pg_roles WHERE rolname = ${PANEL_ROLE})`;
  for (const { datname } of holders) {
    runSql(databaseUrl(datname), `DROP OWNED BY ${PANEL_ROLE}`);
  }
  await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${PANEL_ROLE}`);
}

async function migratedDatabase(): Promise<string> {
  const name = `w2m_migration_${randomUUID().replaceAll("-", "")}`;
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  databases.push(name);

  const url = databaseUrl(name);
  const earlier = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => /^\d{14}_/.test(entry) && entry < MIGRATION)
    .sort();
  runSql(url, earlier.map(migrationSql).join("\n"));
  runSql(url, migrationSql(MIGRATION));
  return url;
}

const columns = (db: PrismaClient) =>
  db.$queryRaw`
    SELECT table_name, column_name, data_type, character_maximum_length AS max_length, is_nullable
    FROM information_schema.columns
    WHERE table_name IN ('meeting_visit', 'venue_search')
    ORDER BY table_name, ordinal_position`;

const panelPrivileges = (db: PrismaClient) =>
  db.$queryRaw`
    SELECT t AS table_name,
      has_table_privilege(${PANEL_ROLE}, t, 'SELECT') AS can_select,
      has_table_privilege(${PANEL_ROLE}, t, 'INSERT') AS can_insert
    FROM unnest(ARRAY['meeting_visit', 'venue_search', 'event']) AS t
    ORDER BY t`;

describe(`migration ${MIGRATION}`, () => {
  let withoutRole: PrismaClient;
  let withRole: PrismaClient;

  beforeAll(async () => {
    await dropPanelRole();
    withoutRole = new PrismaClient({ datasourceUrl: await migratedDatabase() });

    await admin.$executeRawUnsafe(`CREATE ROLE ${PANEL_ROLE} NOLOGIN`);
    withRole = new PrismaClient({ datasourceUrl: await migratedDatabase() });
  }, 120_000);

  afterAll(async () => {
    await withoutRole?.$disconnect();
    await withRole?.$disconnect();
    for (const name of databases) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    await dropPanelRole();
    await admin.$disconnect();
  }, 120_000);

  it("applies on a database without the panel role and creates both tables", async () => {
    expect(await columns(withoutRole)).toEqual([
      { table_name: "meeting_visit", column_name: "id", data_type: "uuid", max_length: null, is_nullable: "NO" },
      { table_name: "meeting_visit", column_name: "event_id", data_type: "character varying", max_length: 64, is_nullable: "NO" },
      { table_name: "meeting_visit", column_name: "participant_id", data_type: "uuid", max_length: null, is_nullable: "YES" },
      { table_name: "meeting_visit", column_name: "started_at", data_type: "timestamp without time zone", max_length: null, is_nullable: "NO" },
      { table_name: "meeting_visit", column_name: "last_seen_at", data_type: "timestamp without time zone", max_length: null, is_nullable: "NO" },
      { table_name: "venue_search", column_name: "id", data_type: "uuid", max_length: null, is_nullable: "NO" },
      { table_name: "venue_search", column_name: "event_id", data_type: "character varying", max_length: 64, is_nullable: "NO" },
      { table_name: "venue_search", column_name: "participant_id", data_type: "uuid", max_length: null, is_nullable: "YES" },
      { table_name: "venue_search", column_name: "query", data_type: "character varying", max_length: 255, is_nullable: "NO" },
      { table_name: "venue_search", column_name: "result_count", data_type: "integer", max_length: null, is_nullable: "NO" },
      { table_name: "venue_search", column_name: "created_at", data_type: "timestamp without time zone", max_length: null, is_nullable: "NO" },
    ]);
  });

  it("grants the panel role read access to the two new tables only", async () => {
    expect(await panelPrivileges(withRole)).toEqual([
      { table_name: "event", can_select: false, can_insert: false },
      { table_name: "meeting_visit", can_select: true, can_insert: false },
      { table_name: "venue_search", can_select: true, can_insert: false },
    ]);
  });

  it("removes a meeting's rows with the meeting and keeps them when a participant leaves", async () => {
    await withoutRole.$executeRaw`
      INSERT INTO event (id, title, updated_at) VALUES (${EVENT_ID}, 'Dinner', now())`;
    await withoutRole.$executeRaw`
      INSERT INTO participant (id, event_id, name, color, is_organizer)
      VALUES (${PARTICIPANT_ID}::uuid, ${EVENT_ID}, 'Bea', 'teal', false)`;
    await withoutRole.$executeRaw`
      INSERT INTO meeting_visit (id, event_id, participant_id)
      VALUES (${randomUUID()}::uuid, ${EVENT_ID}, ${PARTICIPANT_ID}::uuid)`;
    await withoutRole.$executeRaw`
      INSERT INTO venue_search (id, event_id, participant_id, query, result_count)
      VALUES (${randomUUID()}::uuid, ${EVENT_ID}, ${PARTICIPANT_ID}::uuid, 'ramen', 7)`;

    await withoutRole.$executeRaw`DELETE FROM participant WHERE id = ${PARTICIPANT_ID}::uuid`;
    const afterParticipantLeft = {
      visits: await withoutRole.$queryRaw`SELECT event_id, participant_id FROM meeting_visit`,
      searches: await withoutRole.$queryRaw`
        SELECT event_id, participant_id, query, result_count FROM venue_search`,
    };

    await withoutRole.$executeRaw`DELETE FROM event WHERE id = ${EVENT_ID}`;
    const afterMeetingDeleted = {
      visits: await withoutRole.$queryRaw`SELECT event_id FROM meeting_visit`,
      searches: await withoutRole.$queryRaw`SELECT event_id FROM venue_search`,
    };

    expect({ afterParticipantLeft, afterMeetingDeleted }).toEqual({
      afterParticipantLeft: {
        visits: [{ event_id: EVENT_ID, participant_id: null }],
        searches: [{ event_id: EVENT_ID, participant_id: null, query: "ramen", result_count: 7 }],
      },
      afterMeetingDeleted: { visits: [], searches: [] },
    });
  });

  it("leaves the database matching schema.prisma", () => {
    const diff = execFileSync(
      PRISMA_CLI,
      [
        "migrate",
        "diff",
        "--from-url",
        databaseUrl(databases[0] ?? ""),
        "--to-schema-datamodel",
        SCHEMA,
        "--script",
      ],
      { encoding: "utf8" }
    );

    expect(diff.trim()).toBe("-- This is an empty migration.");
  });
});
