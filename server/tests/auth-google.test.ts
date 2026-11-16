import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type CryptoKey } from "jose";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { createGoogleIdTokenVerifier } from "../src/lib/googleIdToken.js";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const KEY_ID = "test-key";

describe("POST /api/auth/google", () => {
  let server: FastifyInstance;
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: KEY_ID, alg: "RS256" };
    const googleVerifier = createGoogleIdTokenVerifier({
      clientId: CLIENT_ID,
      getKey: createLocalJWKSet({ keys: [publicJwk] }),
    });
    server = await buildServer({ googleVerifier });
  });

  afterAll(async () => {
    await server.close();
  });

  function uniqueEmail(): string {
    return `google-${randomUUID()}@example.com`;
  }

  async function signToken(
    claims: Record<string, unknown>,
    {
      audience = CLIENT_ID,
      expiresAt = "1h",
    }: { audience?: string; expiresAt?: string | number } = {}
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
      .setIssuer("https://accounts.google.com")
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(privateKey);
  }

  async function signIn(credential: string) {
    return server.inject({ method: "POST", url: "/api/auth/google", payload: { credential } });
  }

  function sessionCookie(response: { cookies: { name: string; value: string }[] }): string {
    const cookie = response.cookies.find((c) => c.name === "session_token");
    if (!cookie) throw new Error("session_token cookie not set");
    return cookie.value;
  }

  async function getSession(token: string) {
    return server.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: { session_token: token },
    });
  }

  it("creates a verified user from the token and signs them in", async () => {
    const email = uniqueEmail();
    const response = await signIn(
      await signToken({
        sub: `sub-${randomUUID()}`,
        email,
        email_verified: true,
        name: "Ada Lovelace",
        picture: "https://example.com/ada.png",
      })
    );

    expect(response.statusCode).toBe(201);
    const { user } = response.json();
    expect(user.email).toBe(email);
    expect(user.emailVerified).toBe(true);
    expect(user.name).toBe("Ada Lovelace");
    expect(user.avatarUrl).toBe("https://example.com/ada.png");

    const session = await getSession(sessionCookie(response));
    expect(session.statusCode).toBe(200);
    expect(session.json().user.id).toBe(user.id);
  });

  it("returns the same user when the same Google account signs in again", async () => {
    const claims = { sub: `sub-${randomUUID()}`, email: uniqueEmail(), email_verified: true };
    const first = await signIn(await signToken(claims));
    const second = await signIn(await signToken(claims));

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().user.id).toBe(first.json().user.id);
  });

  it("links an unverified email account and revokes its password and sessions", async () => {
    const email = uniqueEmail();
    const register = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "squatter-password" },
    });
    expect(register.statusCode).toBe(201);
    const oldSession = sessionCookie(register);

    const response = await signIn(
      await signToken({ sub: `sub-${randomUUID()}`, email, email_verified: "true" })
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe(register.json().user.id);
    expect(response.json().user.emailVerified).toBe(true);

    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "squatter-password" },
    });
    expect(login.statusCode).toBe(401);
    expect((await getSession(oldSession)).statusCode).toBe(401);
    expect((await getSession(sessionCookie(response))).statusCode).toBe(200);
  });

  it("rejects a token issued for another client", async () => {
    const token = await signToken(
      { sub: `sub-${randomUUID()}`, email: uniqueEmail(), email_verified: true },
      { audience: "someone-else.apps.googleusercontent.com" }
    );
    const response = await signIn(token);
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Invalid Google credential");
  });

  it("rejects an expired token", async () => {
    const token = await signToken(
      { sub: `sub-${randomUUID()}`, email: uniqueEmail(), email_verified: true },
      { expiresAt: Math.floor(Date.now() / 1000) - 60 }
    );
    const response = await signIn(token);
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Invalid Google credential");
  });

  it("rejects an email Google has not verified", async () => {
    const response = await signIn(
      await signToken({ sub: `sub-${randomUUID()}`, email: uniqueEmail(), email_verified: false })
    );
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("replies 503 when Google sign-in is not configured", async () => {
    const disabled = await buildServer({ googleVerifier: null });
    try {
      const response = await disabled.inject({
        method: "POST",
        url: "/api/auth/google",
        payload: { credential: "anything" },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe("GOOGLE_SIGNIN_DISABLED");
    } finally {
      await disabled.close();
    }
  });
});
