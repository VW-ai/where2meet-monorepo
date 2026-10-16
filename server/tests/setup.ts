import { vi } from "vitest";

// Set environment variables before any module imports
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5434/where2meet?schema=public";
process.env.REDIS_URL = "redis://localhost:6380";
process.env.PORT = "3001";
process.env.HOST = "127.0.0.1";

// A pass-through mock, so any test can fix the draws behind approximate areas with drawWith
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});
