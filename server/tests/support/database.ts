import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const execute = promisify(execFile);
const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

export async function createTestDatabase() {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const url = new URL(configured);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("Integration tests require a loopback PostgreSQL server");
  }
  const schema = `w2m_test_${randomBytes(12).toString("hex")}`;
  url.searchParams.set("schema", schema);
  const databaseUrl = url.toString();
  const database = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await execute(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    await database.$connect();
  } catch {
    await database.$disconnect();
    throw new Error("Could not deploy migrations to the isolated test schema");
  }
  return {
    database,
    databaseUrl,
    schema,
    async reset() {
      await database.$transaction([
        database.userEvent.deleteMany(),
        database.vote.deleteMany(),
        database.participant.deleteMany(),
        database.event.deleteMany(),
        database.venue.deleteMany(),
        database.userSession.deleteMany(),
        database.userIdentity.deleteMany(),
        database.user.deleteMany(),
      ]);
    },
    async close() {
      if (
        !/^w2m_test_[0-9a-f]{24}$/.test(schema) ||
        new URL(databaseUrl).searchParams.get("schema") !== schema
      ) {
        throw new Error("Refusing to remove an unexpected test schema");
      }
      try {
        await database.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await database.$disconnect();
      }
    },
  };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
