import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildServer } from "../src/server.js";
import { prisma } from "../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

// Mock Geocoding API for participant creation
vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockImplementation((address: string) => {
    return Promise.resolve({
      lat: 40.7128,
      lng: -74.006,
      formattedAddress: address,
    });
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

describe("User Endpoints", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  /**
   * Helper to register a user and return session cookie.
   */
  async function registerUser(email?: string, name?: string) {
    const userEmail = email ?? `user-${Date.now()}@example.com`;
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: userEmail, password: "password123", name },
    });

    const cookies = response.cookies;
    const sessionCookie = cookies.find((c) => c.name === "session_token");
    return {
      user: response.json().user,
      sessionToken: sessionCookie!.value,
    };
  }

  /**
   * Helper to create an event and get participant token.
   */
  async function createEvent(title?: string, fields: Record<string, string> = {}) {
    const response = await server.inject({
      method: "POST",
      url: "/api/events",
      payload: { title: title ?? `Event-${Date.now()}`, ...fields },
    });
    const body = response.json();
    return {
      eventId: body.id,
      participantToken: body.participantToken,
      organizerParticipantId: body.organizerParticipantId,
    };
  }

  describe("DELETE /api/users/me", () => {
    async function claim(sessionToken: string, eventId: string, participantToken: string) {
      await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });
    }
    async function join(eventId: string, name: string) {
      const response = await server.inject({
        method: "POST",
        url: `/api/events/${eventId}/participants`,
        payload: { name, address: "1 Main St" },
      });
      return response.json<{ id: string; participantToken: string }>();
    }
    function deleteAccount(sessionToken: string) {
      return server.inject({
        method: "DELETE",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
      });
    }

    it("should require a session", async () => {
      const response = await server.inject({ method: "DELETE", url: "/api/users/me" });
      expect(response.statusCode).toBe(401);
    });

    it("should end the session and free the email", async () => {
      const email = `delete-${Date.now()}@example.com`;
      const { user, sessionToken } = await registerUser(email, "Leaving");

      const response = await deleteAccount(sessionToken);

      expect(response.statusCode).toBe(200);
      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      const session = await server.inject({
        method: "GET",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
      });
      expect(session.statusCode).toBe(401);
      const again = await server.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });
      expect(again.statusCode).toBe(201);
    });

    it("should delete a meeting nobody else joined", async () => {
      const { sessionToken } = await registerUser(`solo-${Date.now()}@example.com`);
      const { eventId, participantToken } = await createEvent();
      await claim(sessionToken, eventId, participantToken);
      await server.inject({
        method: "POST",
        url: `/api/events/${eventId}/participants`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: { name: "Added by organizer", address: "2 Main St" },
      });

      await deleteAccount(sessionToken);

      expect(await prisma.event.findUnique({ where: { id: eventId } })).toBeNull();
    });

    it("should keep a meeting others joined, without the organizer's data", async () => {
      const { sessionToken } = await registerUser(`host-${Date.now()}@example.com`);
      const { eventId, participantToken, organizerParticipantId } = await createEvent();
      await claim(sessionToken, eventId, participantToken);
      await prisma.participant.update({
        where: { id: organizerParticipantId },
        data: { name: "Real Name", address: "Home", formattedAddress: "Home", lat: 1, lng: 2 },
      });
      await prisma.meetingVisit.create({ data: { eventId, participantId: organizerParticipantId } });
      await prisma.venueSearch.create({
        data: { eventId, participantId: organizerParticipantId, query: "cafe", resultCount: 1 },
      });
      const guest = await join(eventId, "Guest");

      await deleteAccount(sessionToken);

      const organizer = await prisma.participant.findUniqueOrThrow({
        where: { id: organizerParticipantId },
      });
      expect(organizer).toMatchObject({
        name: "Former guest",
        address: null,
        formattedAddress: null,
        lat: null,
        lng: null,
        tokenHash: null,
      });
      const stillThere = await prisma.participant.findUniqueOrThrow({ where: { id: guest.id } });
      expect(stillThere).toMatchObject({ name: "Guest", address: "1 Main St" });
      expect(await prisma.meetingVisit.count({ where: { eventId } })).toBe(0);
      expect(await prisma.venueSearch.count({ where: { eventId } })).toBe(0);
    });

    it("should remove a guest's data from someone else's meeting", async () => {
      const { sessionToken } = await registerUser(`guest-${Date.now()}@example.com`);
      const { eventId, organizerParticipantId } = await createEvent();
      const guest = await join(eventId, "Guest");
      await claim(sessionToken, eventId, guest.participantToken);

      await deleteAccount(sessionToken);

      expect(await prisma.event.findUnique({ where: { id: eventId } })).not.toBeNull();
      const row = await prisma.participant.findUniqueOrThrow({ where: { id: guest.id } });
      expect(row).toMatchObject({ name: "Former guest", address: null, tokenHash: null });
      expect(
        await prisma.participant.findUnique({ where: { id: organizerParticipantId } })
      ).not.toBeNull();
    });
  });

  describe("GET /api/users/me", () => {
    it("should return user profile", async () => {
      const { user, sessionToken } = await registerUser(undefined, "Profile User");

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: user.id,
        email: user.email,
        name: "Profile User",
        avatarUrl: null,
        emailVerified: false,
        defaultAddress: null,
        defaultPlaceId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("should return 401 without session", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/users/me",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/users/me", () => {
    it("should update user name", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: { name: "Updated Name" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe("Updated Name");
    });

    it("should update default address", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: {
          defaultAddress: "123 Main St, City",
          defaultPlaceId: "place_123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.defaultAddress).toBe("123 Main St, City");
      expect(body.defaultPlaceId).toBe("place_123");
    });

    it("should ignore the default approximate-location setting an older client sends", async () => {
      const { user, sessionToken } = await registerUser();

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: { name: "Ana", defaultFuzzyLocation: true },
      });
      const saved = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { name: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: user.id,
        email: user.email,
        name: "Ana",
        avatarUrl: null,
        emailVerified: false,
        defaultAddress: null,
        defaultPlaceId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(saved).toEqual({ name: "Ana" });
    });

    it("should answer an older client's settings save with only the default approximate-location setting with the unchanged profile", async () => {
      const { user, sessionToken } = await registerUser(undefined, "Old Tab");

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: { defaultFuzzyLocation: true },
      });
      const saved = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { name: true },
      });

      expect([response.statusCode, response.json()]).toEqual([
        200,
        {
          id: user.id,
          email: user.email,
          name: "Old Tab",
          avatarUrl: null,
          emailVerified: false,
          defaultAddress: null,
          defaultPlaceId: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ]);
      expect(saved).toEqual({ name: "Old Tab" });
    });

    it("should clear name by setting to null", async () => {
      const { sessionToken } = await registerUser(undefined, "Initial Name");

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: { name: null },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBeNull();
    });

    it("should return 400 with empty body", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        cookies: { session_token: sessionToken },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without session", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/users/me",
        payload: { name: "New Name" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/users/me/events", () => {
    it("should return empty list for new user", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me/events",
        cookies: { session_token: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("events");
      expect(body.events).toHaveLength(0);
    });

    it("should return claimed events", async () => {
      const { sessionToken } = await registerUser();
      const { eventId, participantToken } = await createEvent("Claimed Event");

      // Claim the event
      await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      // List events
      const response = await server.inject({
        method: "GET",
        url: "/api/users/me/events",
        cookies: { session_token: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event.id).toBe(eventId);
      expect(body.events[0].event.title).toBe("Claimed Event");
      expect(body.events[0].role).toBe("organizer");
    });

    it("should list a claimed event's meeting time zone", async () => {
      const { sessionToken } = await registerUser();
      const { eventId, participantToken } = await createEvent("Paris Brunch", {
        meetingTime: "2026-10-18T09:00:00.000Z",
        meetingTimeZone: "Europe/Paris",
      });

      await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/users/me/events",
        cookies: { session_token: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().events[0].event.meetingTimeZone).toBe("Europe/Paris");
    });

    it("should return 401 without session", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/users/me/events",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/users/me/events/claim", () => {
    it("should claim an event as organizer", async () => {
      const { sessionToken } = await registerUser();
      const { eventId, participantToken, organizerParticipantId } = await createEvent();

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.userEvent.eventId).toBe(eventId);
      expect(body.userEvent.role).toBe("organizer");
      expect(body.userEvent.participantId).toBe(organizerParticipantId);
    });

    it("should claim an event as participant", async () => {
      const { sessionToken } = await registerUser();
      const { eventId } = await createEvent();

      // Add a new participant
      const participantResponse = await server.inject({
        method: "POST",
        url: `/api/events/${eventId}/participants`,
        payload: {
          name: "Test Participant",
          address: "456 Oak St",
        },
      });

      const participantBody = participantResponse.json();
      const participantToken = participantBody.participantToken;

      // Claim as participant
      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.userEvent.role).toBe("participant");
    });

    it("should be idempotent (claiming twice returns same result)", async () => {
      const { sessionToken } = await registerUser();
      const { eventId, participantToken } = await createEvent();

      // Claim first time
      const response1 = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      // Claim second time
      const response2 = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken },
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);
      const body1 = response1.json();
      const body2 = response2.json();
      expect(body1.userEvent.id).toBe(body2.userEvent.id);
    });

    it("should return 400 for malformed participant token", async () => {
      const { sessionToken } = await registerUser();
      const { eventId } = await createEvent();

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken: "invalid_token" },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json() as { error: { code: string; message: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 403 for valid format but non-existent participant token", async () => {
      const { sessionToken } = await registerUser();
      const { eventId } = await createEvent();

      // Well-formed token that doesn't exist
      const fakeToken = "pt_0000000000000000000000000000000000000000000000000000000000000000";

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: { eventId, participantToken: fakeToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 for non-existent event", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: {
          eventId: "evt_0000000000000_0000000000000000",
          participantToken: "pt_0000000000000000000000000000000000000000000000000000000000000000",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 400 for invalid event ID format", async () => {
      const { sessionToken } = await registerUser();

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        cookies: { session_token: sessionToken },
        payload: {
          eventId: "invalid-id",
          participantToken: "pt_token",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without session", async () => {
      const { eventId, participantToken } = await createEvent();

      const response = await server.inject({
        method: "POST",
        url: "/api/users/me/events/claim",
        payload: { eventId, participantToken },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
