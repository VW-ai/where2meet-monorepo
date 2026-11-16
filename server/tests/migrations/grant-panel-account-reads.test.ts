import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MIGRATION = "20261116120000_grant_panel_account_reads";
const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));
const PANEL_ROLE = "control_usage";

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

async function migratedDatabase(): Promise<PrismaClient> {
  const name = `w2m_migration_${randomUUID().replaceAll("-", "")}`;
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  databases.push(name);
  const url = databaseUrl(name);
  const upTo = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => /^\d{14}_/.test(entry) && entry <= MIGRATION)
    .sort();
  runSql(url, upTo.map((entry) => readFileSync(`${MIGRATIONS_DIR}${entry}/migration.sql`, "utf8")).join("\n"));
  return new PrismaClient({ datasourceUrl: url });
}

const readable = (db: PrismaClient) =>
  db.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('user', 'user_identity', 'user_session', 'user_event')
      AND has_column_privilege(${PANEL_ROLE}, format('%I', table_name), column_name, 'SELECT')
    ORDER BY table_name, column_name`;

describe(`migration ${MIGRATION}`, () => {
  let withoutRole: PrismaClient;
  let withRole: PrismaClient;

  beforeAll(async () => {
    await dropPanelRole();
    withoutRole = await migratedDatabase();
    await admin.$executeRawUnsafe(`CREATE ROLE ${PANEL_ROLE} NOLOGIN`);
    withRole = await migratedDatabase();
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

  it("applies on a database without the panel role", async () => {
    expect(await withoutRole.$queryRaw`SELECT count(*)::int AS users FROM "user"`).toEqual([{ users: 0 }]);
  });

  it("lets the panel read account facts but never passwords, session tokens or saved addresses", async () => {
    const columns = (await readable(withRole)).map((row) => `${row.table_name}.${row.column_name}`);
    expect(columns).toEqual([
      "user.created_at",
      "user.email",
      "user.email_verified",
      "user.id",
      "user.name",
      "user_event.created_at",
      "user_event.event_id",
      "user_event.id",
      "user_event.participant_id",
      "user_event.role",
      "user_event.user_id",
      "user_identity.created_at",
      "user_identity.provider",
      "user_identity.user_id",
      "user_session.created_at",
      "user_session.user_id",
    ]);
  });
});
