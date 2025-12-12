import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

describe("Event Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("POST /api/events", () => {
    it("should create an event with valid data", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Team Lunch",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("title", "Team Lunch");
      expect(body).toHaveProperty("meetingTime", "2024-12-15T12:00:00.000Z");
      expect(body).toHaveProperty("organizerToken");
      expect(body.organizerToken).toHaveLength(64);
      expect(body).toHaveProperty("participants");
      expect(body.participants).toEqual([]);
    });

    it("should create an event without meetingTime", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Quick Meetup",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("title", "Quick Meetup");
      expect(body.meetingTime).toBeNull();
    });

    it("should return 400 for missing title", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should return 400 for empty title", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for title exceeding max length", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "A".repeat(101),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid datetime format", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Test Event",
          meetingTime: "not-a-date",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/events/:id", () => {
    let createdEventId: string;
    let organizerToken: string;

    beforeEach(async () => {
      // Create a fresh event for each test
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Test Event",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      organizerToken = created.organizerToken;
    });

    it("should get an existing event", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("id", createdEventId);
      expect(body).toHaveProperty("title", "Test Event");
      // organizerToken should NOT be in the response
      expect(body).not.toHaveProperty("organizerToken");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/events/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PATCH /api/events/:id", () => {
    let createdEventId: string;
    let organizerToken: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Original Title",
          meetingTime: "2024-12-15T12:00:00Z",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      organizerToken = created.organizerToken;
    });

    it("should update event with valid token", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe("Updated Title");
    });

    it("should update meetingTime", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        payload: {
          meetingTime: "2024-12-20T18:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.meetingTime).toBe("2024-12-20T18:00:00.000Z");
    });

    it("should clear meetingTime with null", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        payload: {
          meetingTime: null,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.meetingTime).toBeNull();
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: "Bearer invalid-token-that-is-definitely-wrong",
        },
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/events/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        payload: {
          title: "Should Fail",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 400 for empty update body", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/events/:id", () => {
    let createdEventId: string;
    let organizerToken: string;

    beforeEach(async () => {
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/events",
        payload: {
          title: "Event to Delete",
        },
      });
      const created = createResponse.json();
      createdEventId = created.id;
      organizerToken = created.organizerToken;
    });

    it("should delete event with valid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Event deleted successfully");

      // Verify event is actually deleted
      const getResponse = await server.inject({
        method: "GET",
        url: `/api/events/${createdEventId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 401 without authorization header", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 with invalid token", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: `/api/events/${createdEventId}`,
        headers: {
          authorization: "Bearer wrong-token",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent event", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: "/api/events/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
