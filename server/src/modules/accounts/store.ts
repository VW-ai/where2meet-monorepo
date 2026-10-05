import { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "../../errors.js";
import { hashToken } from "../../runtime/credentials.js";
import { writeTransaction } from "../../runtime/database.js";
import type { Accounts } from "./types.js";

const profileFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  emailVerified: true,
  defaultAddress: true,
  defaultPlaceId: true,
  defaultFuzzyLocation: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

function newId(prefix: "usr" | "ident" | "ses"): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

function newSession() {
  const credential = `st_${randomBytes(32).toString("hex")}`;
  const lifetimeSeconds = 7 * 24 * 60 * 60;
  return {
    credential,
    lifetimeSeconds,
    row: {
      id: newId("ses"),
      tokenHash: hashToken(credential),
      expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
    },
  };
}

export function createAccounts(database: PrismaClient): Accounts {
  return {
    async register(input) {
      const email = input.email.toLowerCase().trim();
      const existing = await database.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw new AppError("EMAIL_EXISTS", "Email is already registered");
      const passwordHash = await bcrypt.hash(input.password, 12);
      const session = newSession();
      try {
        const user = await writeTransaction(database, async (tx) => {
          const user = await tx.user.create({
            data: { id: newId("usr"), email, name: input.name ?? null },
            select: profileFields,
          });
          await tx.userIdentity.create({
            data: {
              id: newId("ident"),
              userId: user.id,
              provider: "email",
              providerId: email,
              passwordHash,
            },
          });
          await tx.userSession.create({ data: { ...session.row, userId: user.id } });
          return user;
        });
        return {
          user,
          credential: session.credential,
          expiresAt: session.row.expiresAt,
          lifetimeSeconds: session.lifetimeSeconds,
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const target = error.meta?.target;
          if (
            Array.isArray(target) &&
            (target.includes("email") ||
              (target.includes("provider") && target.includes("provider_id")))
          )
            throw new AppError("EMAIL_EXISTS", "Email is already registered");
        }
        throw error;
      }
    },
    async login(input) {
      const email = input.email.toLowerCase().trim();
      const identity = await database.userIdentity.findUnique({
        where: { provider_providerId: { provider: "email", providerId: email } },
        select: { passwordHash: true, user: { select: profileFields } },
      });
      if (
        !identity?.passwordHash ||
        !(await bcrypt.compare(input.password, identity.passwordHash).catch(() => false))
      )
        throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
      const session = newSession();
      try {
        await database.userSession.create({ data: { ...session.row, userId: identity.user.id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")
          throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
        throw error;
      }
      return {
        user: identity.user,
        credential: session.credential,
        expiresAt: session.row.expiresAt,
        lifetimeSeconds: session.lifetimeSeconds,
      };
    },
    async session(credential) {
      const session = await database.userSession.findUnique({
        where: { tokenHash: hashToken(credential) },
        select: { id: true, expiresAt: true, user: { select: profileFields } },
      });
      if (!session) throw new AppError("UNAUTHORIZED", "Invalid session");
      if (session.expiresAt < new Date()) {
        await database.userSession.deleteMany({ where: { id: session.id } });
        throw new AppError("UNAUTHORIZED", "Session expired");
      }
      return { user: session.user, expiresAt: session.expiresAt };
    },
    async logout(credential) {
      if (credential)
        await database.userSession.deleteMany({ where: { tokenHash: hashToken(credential) } });
    },
    async updateProfile({ userId, patch }) {
      try {
        return await database.user.update({
          where: { id: userId },
          data: patch,
          select: profileFields,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
          throw new AppError("NOT_FOUND", "User not found");
        throw error;
      }
    },
  };
}
