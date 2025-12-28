import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

describe("Authentication Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const email = `test-${Date.now()}@example.com`;
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email,
          password: "password123",
          name: "Test User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("user");
      expect(body.user).toHaveProperty("id");
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.name).toBe("Test User");
      expect(body.user.emailVerified).toBe(false);

      // Should set session cookie
      const cookies = response.cookies;
      const sessionCookie = cookies.find((c) => c.name === "session_token");
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.httpOnly).toBe(true);
    });

    it("should register a user without name", async () => {
      const email = `test-${Date.now()}@example.com`;
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.name).toBeNull();
    });

    it("should normalize email to lowercase", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `TEST-${Date.now()}@EXAMPLE.COM`,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toMatch(/^test-\d+@example\.com$/);
    });

    it("should return 400 for invalid email format", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "not-an-email",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for password too short", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `test-${Date.now()}@example.com`,
          password: "short",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 409 for duplicate email", async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      // Register first time
      await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email,
          password: "password123",
        },
      });

      // Try to register again
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe("EMAIL_EXISTS");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const email = `login-${Date.now()}@example.com`;
      const password = "password123";

      // Register first
      await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password },
      });

      // Login
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe(email.toLowerCase());

      // Should set session cookie
      const cookies = response.cookies;
      const sessionCookie = cookies.find((c) => c.name === "session_token");
      expect(sessionCookie).toBeDefined();
    });

    it("should return 401 for wrong password", async () => {
      const email = `wrong-pass-${Date.now()}@example.com`;

      // Register
      await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });

      // Login with wrong password
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "wrongpassword" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should return 401 for non-existent email", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: `nonexistent-${Date.now()}@example.com`,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should be case-insensitive for email", async () => {
      const email = `case-${Date.now()}@example.com`;
      const password = "password123";

      // Register
      await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password },
      });

      // Login with uppercase email
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: email.toUpperCase(), password },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout and clear session cookie", async () => {
      const email = `logout-${Date.now()}@example.com`;

      // Register
      const registerResponse = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });

      const cookies = registerResponse.cookies;
      const sessionCookie = cookies.find((c) => c.name === "session_token");

      // Logout
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/logout",
        cookies: { session_token: sessionCookie!.value },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);

      // Session cookie should be cleared (maxAge = 0)
      const logoutCookies = response.cookies;
      const clearedCookie = logoutCookies.find((c) => c.name === "session_token");
      expect(clearedCookie?.maxAge).toBe(0);
    });

    it("should succeed even without session cookie", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });

  describe("GET /api/auth/session", () => {
    it("should return user for valid session", async () => {
      const email = `session-${Date.now()}@example.com`;

      // Register
      const registerResponse = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123", name: "Session User" },
      });

      const cookies = registerResponse.cookies;
      const sessionCookie = cookies.find((c) => c.name === "session_token");

      // Check session
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/session",
        cookies: { session_token: sessionCookie!.value },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe(email.toLowerCase());
      expect(body.user.name).toBe("Session User");
    });

    it("should return 401 without session cookie", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/session",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 for invalid session token", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/session",
        cookies: { session_token: "invalid_token" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 after logout", async () => {
      const email = `session-logout-${Date.now()}@example.com`;

      // Register
      const registerResponse = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });

      const cookies = registerResponse.cookies;
      const sessionCookie = cookies.find((c) => c.name === "session_token");

      // Logout
      await server.inject({
        method: "POST",
        url: "/api/auth/logout",
        cookies: { session_token: sessionCookie!.value },
      });

      // Try to check session with old token
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/session",
        cookies: { session_token: sessionCookie!.value },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
