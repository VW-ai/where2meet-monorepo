import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MIGRATION = "20261019180000_remove_approximate_locations";
const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));

const EVENT_ID = "evt_1760000000000_abcdefghijklmnop";
const ORGANIZER_ID = "00000000-0000-4000-8000-000000000001";
const EXACT_ID = "00000000-0000-4000-8000-000000000002";
const APPROXIMATE_ID = "00000000-0000-4000-8000-000000000003";

const databaseName = `w2m_migration_${randomUUID().replaceAll("-", "")}`;
const adminUrl = process.env.DATABASE_URL ?? "";
const scratchUrl = (() => {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
})();

const admin = new PrismaClient({ datasourceUrl: adminUrl });
const scratch = new PrismaClient({ datasourceUrl: scratchUrl });

function runSql(sql: string): void {
  execFileSync(PRISMA_CLI, ["db", "execute", "--url", scratchUrl, "--stdin"], {
    input: sql,
    stdio: ["pipe", "ignore", "pipe"],
  });
}

function migrationSql(name: string): string {
  return readFileSync(`${MIGRATIONS_DIR}${name}/migration.sql`, "utf8");
}

const participantRows = () =>
  scratch.$queryRaw`
    SELECT * FROM (
      SELECT p.name, p.address, p.formatted_address, p.lat::text AS lat, p.lng::text AS lng,
        p.color, p.is_organizer, p.token_hash, count(v.id)::int AS votes
      FROM participant p LEFT JOIN vote v ON v.participant_id = p.id
      GROUP BY p.id
    ) rows ORDER BY name`;

const approximateColumns = () =>
  scratch.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE column_name IN ('fuzzy_location', 'default_fuzzy_location')
    ORDER BY table_name`;

describe(`migration ${MIGRATION}`, () => {
  let before: { participants: unknown; columns: unknown };

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);

    const earlier = readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d{14}_/.test(name) && name < MIGRATION)
      .sort();
    runSql(earlier.map(migrationSql).join("\n"));

    await scratch.$executeRaw`
      INSERT INTO event (id, title, updated_at) VALUES (${EVENT_ID}, 'Dinner', now())`;
    await scratch.$executeRaw`
      INSERT INTO participant
        (id, event_id, name, address, formatted_address, lat, lng, fuzzy_location, color, is_organizer, token_hash)
      VALUES
        (${ORGANIZER_ID}::uuid, ${EVENT_ID}, 'Olu', NULL, NULL, NULL, NULL, false, 'coral', true, 'hash-olu'),
        (${EXACT_ID}::uuid, ${EVENT_ID}, 'Bea', '350 5th Ave', '350 5th Ave, New York, NY 10118, USA',
          40.7484405, -73.9856644, false, 'teal', false, 'hash-bea'),
        (${APPROXIMATE_ID}::uuid, ${EVENT_ID}, 'Ana', '456 Oak Ave', '456 Oak Ave, New York, NY 10001, USA',
          40.7199865, -74.0060000, true, 'gold', false, 'hash-ana')`;
    await scratch.$executeRaw`
      INSERT INTO venue (id, name, lat, lng, updated_at)
      VALUES ('place_1', 'Corner Cafe', 40.7300000, -73.9900000, now())`;
    await scratch.$executeRaw`
      INSERT INTO vote (id, event_id, participant_id, venue_id) VALUES
        (${randomUUID()}::uuid, ${EVENT_ID}, ${APPROXIMATE_ID}::uuid, 'place_1'),
        (${randomUUID()}::uuid, ${EVENT_ID}, ${EXACT_ID}::uuid, 'place_1')`;
    await scratch.$executeRaw`
      INSERT INTO "user" (id, email, name, default_fuzzy_location, updated_at)
      VALUES ('usr_1', 'ana@example.com', 'Ana', true, now())`;

    before = { participants: await participantRows(), columns: await approximateColumns() };

    runSql(migrationSql(MIGRATION));
  }, 60_000);

  afterAll(async () => {
    await scratch.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.$disconnect();
  }, 60_000);

  it("starts from approximate and exact participants and an approximate default", () => {
    expect(before).toEqual({
      participants: [
        {
          name: "Ana",
          address: "456 Oak Ave",
          formatted_address: "456 Oak Ave, New York, NY 10001, USA",
          lat: "40.7199865",
          lng: "-74.0060000",
          color: "gold",
          is_organizer: false,
          token_hash: "hash-ana",
          votes: 1,
        },
        {
          name: "Bea",
          address: "350 5th Ave",
          formatted_address: "350 5th Ave, New York, NY 10118, USA",
          lat: "40.7484405",
          lng: "-73.9856644",
          color: "teal",
          is_organizer: false,
          token_hash: "hash-bea",
          votes: 1,
        },
        {
          name: "Olu",
          address: null,
          formatted_address: null,
          lat: null,
          lng: null,
          color: "coral",
          is_organizer: true,
          token_hash: "hash-olu",
          votes: 0,
        },
      ],
      columns: [
        { table_name: "participant", column_name: "fuzzy_location" },
        { table_name: "user", column_name: "default_fuzzy_location" },
      ],
    });
  });

  it("clears only the approximate participant's starting point and keeps everything else", async () => {
    expect(await participantRows()).toEqual([
      {
        name: "Ana",
        address: null,
        formatted_address: null,
        lat: null,
        lng: null,
        color: "gold",
        is_organizer: false,
        token_hash: "hash-ana",
        votes: 1,
      },
      {
        name: "Bea",
        address: "350 5th Ave",
        formatted_address: "350 5th Ave, New York, NY 10118, USA",
        lat: "40.7484405",
        lng: "-73.9856644",
        color: "teal",
        is_organizer: false,
        token_hash: "hash-bea",
        votes: 1,
      },
      {
        name: "Olu",
        address: null,
        formatted_address: null,
        lat: null,
        lng: null,
        color: "coral",
        is_organizer: true,
        token_hash: "hash-olu",
        votes: 0,
      },
    ]);
  });

  it("drops fuzzy_location and default_fuzzy_location and keeps the user", async () => {
    expect({
      columns: await approximateColumns(),
      users: await scratch.$queryRaw`SELECT id, email, name FROM "user"`,
    }).toEqual({
      columns: [],
      users: [{ id: "usr_1", email: "ana@example.com", name: "Ana" }],
    });
  });

  it("leaves the database matching schema.prisma", () => {
    const schema = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));
    const diff = execFileSync(
      PRISMA_CLI,
      ["migrate", "diff", "--from-url", scratchUrl, "--to-schema-datamodel", schema, "--script"],
      { encoding: "utf8" }
    );

    expect(diff.trim()).toBe("-- This is an empty migration.");
  });
});
