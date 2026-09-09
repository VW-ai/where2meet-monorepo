import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

describe("Health Check Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GET /health", () => {
    it("should return status ok", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });
  });

  describe("GET /health/ready", () => {
    it("should return detailed health status", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/health/ready",
      });

      // Even if services are not running, the endpoint should respond
      const body = response.json();
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("services");
      expect(body.services).toHaveProperty("database");
      expect(body.services).toHaveProperty("redis");
    });
  });
});
