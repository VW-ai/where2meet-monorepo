import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { importData, ImportConflictError } from "./import-data.js";

const file = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (!file || process.argv.length !== 3 || !databaseUrl) {
  process.stderr.write("Usage: DATABASE_URL=... npm run import:data -- /private/path/data.json\n");
  process.exitCode = 1;
} else {
  const database = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const input: unknown = JSON.parse(await readFile(file, "utf8"));
    const result = await importData(database, input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof ImportConflictError ? error.message : "Import failed. Check input format, database access, and constraints."}\n`
    );
    process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}
