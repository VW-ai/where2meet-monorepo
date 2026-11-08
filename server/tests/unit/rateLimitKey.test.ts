import { describe, it, expect } from "vitest";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER, rateLimitKey } from "../../src/lib/rateLimitKey.js";

const SECRET = "s".repeat(40);
const VERCEL_IP = "3.12.0.1";

function fromNext(headers: Record<string, string>) {
  return { ip: VERCEL_IP, headers };
}

describe("rateLimitKey", () => {
  it("keys the Next server's calls on the visitor it forwards", () => {
    const visitorA = fromNext({ [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: "203.0.113.7" });
    const visitorB = fromNext({ [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: "2001:db8::1" });

    expect(rateLimitKey(visitorA, SECRET)).toBe("203.0.113.7");
    expect(rateLimitKey(visitorB, SECRET)).toBe("2001:db8::1");
  });

  it("ignores a forwarded IP sent with the wrong secret", () => {
    const request = fromNext({ [PROXY_SECRET_HEADER]: "guess", [CLIENT_IP_HEADER]: "203.0.113.7" });
    expect(rateLimitKey(request, SECRET)).toBe(VERCEL_IP);
  });

  it("ignores a forwarded IP when no secret is configured", () => {
    const request = fromNext({ [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: "203.0.113.7" });
    expect(rateLimitKey(request, undefined)).toBe(VERCEL_IP);
  });

  it("ignores a forwarded value that is not an IP", () => {
    const request = fromNext({ [PROXY_SECRET_HEADER]: SECRET, [CLIENT_IP_HEADER]: "random-key" });
    expect(rateLimitKey(request, SECRET)).toBe(VERCEL_IP);
  });

  it("keys direct callers on their own IP", () => {
    expect(rateLimitKey({ ip: "198.51.100.4", headers: {} }, SECRET)).toBe("198.51.100.4");
  });
});
