import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkArchitecture } from "../scripts/architecture.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = 'import { PrismaClient } from "@prisma/client"; const db = new PrismaClient();';

describe("module ownership gate", () => {
  it("accepts the current source and same-owner relation queries", () => {
    expect(
      checkArchitecture(root, {
        "src/modules/accounts/store.ts": `${database} void db.userSession.findMany({include:{user:true}});`,
        "src/modules/meetings/store.ts": `${database} void db.event.findMany({include:{participants:true,userEvents:true}});`,
      })
    ).toEqual([]);
  });

  it("rejects illegal imports, model delegates and nested relations including aliases", () => {
    const violations = checkArchitecture(root, {
      "src/http/illegal.ts":
        'import { PrismaClient } from "@prisma/client"; import "../runtime/database.js"; import "../modules/meetings/store.js";',
      "src/modules/meetings/operation.ts":
        'import "@prisma/client"; import "fastify"; import "ioredis"; import "../accounts/store.js";',
      "src/modules/meetings/store.ts": `${database}
        void db.user.findMany();
        void db.vote.findMany({include:{venue:true}});
        const nested = { user: true }; const args = { include: { userEvents: { include: nested } } };
        void db.event.findMany(args);
        const filters = { user: { email: "other@example.test" } };
        void db.userEvent.findMany({where:{...filters}});
        const key = Math.random() ? "venue" : "participant";
        void db.vote.findMany({include:{[key]:true}});
        const read = db.event.findMany; void read();
        void db.$queryRawUnsafe("SELECT 1");`,
    });
    expect(
      violations
        .filter((entry) => entry.file === "src/http/illegal.ts")
        .map((entry) => entry.message)
    ).toEqual(
      expect.arrayContaining([
        "Prisma is limited to module stores and runtime/database",
        "HTTP cannot import database or private stores",
        "Cross-module access must use the public index",
      ])
    );
    expect(
      violations
        .filter((entry) => entry.file === "src/modules/meetings/operation.ts")
        .map((entry) => entry.message)
    ).toEqual(
      expect.arrayContaining([
        "Prisma is limited to module stores and runtime/database",
        "Modules cannot depend on HTTP or Redis",
        "Cross-module access must use the public index",
      ])
    );
    const store = violations.filter((entry) => entry.file === "src/modules/meetings/store.ts");
    expect(
      store.filter((entry) => entry.message === "meetings cannot access User, owned by accounts")
    ).toHaveLength(3);
    expect(store.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        "meetings cannot access Venue, owned by places",
        "Computed query keys must be string literals",
        "Call Prisma delegate methods directly so query ownership can be checked",
        "Raw SQL is not allowed in domain modules",
      ])
    );
  });
});
