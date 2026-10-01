import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { ReplyError } from "ioredis";
import { describeError, scrubCredentials, serializeError } from "../../src/lib/log-redaction.js";
import { createLogger } from "../../src/lib/logger.js";

const PASSWORD = "not-a-real-password-0123456789";

// The shape ioredis emits when Redis rejects the AUTH command
function authFailure(): Error {
  const err = new ReplyError("WRONGPASS invalid username-password pair or user is disabled.");
  Object.assign(err, { command: { name: "auth", args: ["default", PASSWORD] } });
  return err;
}

function captureLogs(): { lines: string[]; stream: Writable } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { lines, stream };
}

describe("log redaction", () => {
  it("drops Redis command arguments but keeps the failure details", () => {
    const serialized = serializeError(authFailure()) as Record<string, unknown>;

    expect(JSON.stringify(serialized)).not.toContain(PASSWORD);
    expect(serialized.type).toBe("ReplyError");
    expect(serialized.message).toContain("WRONGPASS");
    expect(serialized.command).toEqual({ name: "auth" });
  });

  it("redacts errors nested as a cause", () => {
    const wrapper = new Error("Redis publisher failed", { cause: authFailure() });

    expect(JSON.stringify(serializeError(wrapper))).not.toContain(PASSWORD);
  });

  it("masks credentials in connection URLs", () => {
    const err = new Error(
      `connect failed for redis://default:${PASSWORD}@redis.railway.internal:6379`
    );
    const serialized = JSON.stringify(serializeError(err));

    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).toContain("redis://***@redis.railway.internal:6379");
    expect(scrubCredentials("postgresql://app:pw@db:5432/x")).toBe("postgresql://***@db:5432/x");
  });

  it("leaves non-error values untouched", () => {
    expect(serializeError("plain message")).toBe("plain message");
  });

  it("describes errors for console output without command data", () => {
    expect(describeError(authFailure())).toBe(
      "ReplyError: WRONGPASS invalid username-password pair or user is disabled."
    );
  });

  it("is the err serializer of the app logger and its children", () => {
    const child = createLogger("SSEPlugin") as unknown as Record<symbol, Record<string, unknown>>;
    expect(child[pino.symbols.serializersSym]?.err).toBe(serializeError);
  });

  it("keeps the AUTH password out of logged output", () => {
    const { lines, stream } = captureLogs();
    const log = pino({ serializers: { err: serializeError } }, stream);

    log.warn({ err: authFailure() }, "Redis publisher error");

    expect(lines.join("")).toContain("WRONGPASS");
    expect(lines.join("")).not.toContain(PASSWORD);
  });
});
