import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../errors.js";
import { hashToken } from "../../runtime/credentials.js";
import type { Accounts } from "./types.js";

export function createAccounts(database: PrismaClient): Accounts {
  return {
    async session(credential) {
      const session = await database.userSession.findUnique({
        where: { tokenHash: hashToken(credential) },
        include: { user: true },
      });
      if (!session) throw new AppError("UNAUTHORIZED", "Invalid session");
      if (session.expiresAt < new Date()) {
        await database.userSession.deleteMany({ where: { id: session.id } });
        throw new AppError("UNAUTHORIZED", "Session expired");
      }
      return { user: session.user, expiresAt: session.expiresAt };
    },
  };
}
