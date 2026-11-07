/**
 * Integration tests for claiming a participant row ("That's me") and undoing it.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7128,
    lng: -74.006,
    formattedAddress: "123 Main Street, New York, NY 10001",
  }),
  AddressNotFoundError: class AddressNotFoundError extends Error {},
  GeocodingApiError: class GeocodingApiError extends Error {},
}));

describe("Claiming a participant", () => {
  let server: FastifyInstance;
  let broadcastMock: ReturnType<typeof vi.fn>;
  let eventId: string;
  let organizerToken: string;
  let organizerId: string;
  let addedId: string;

  const addParticipant = async (name: string, token?: string) =>
    (
      await server.inject({
        method: "POST",
        url: `/api/events/${eventId}/participants`,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        payload: { name, address: "123 Main St" },
      })
    ).json();

  const claim = (id: string, targetEventId = eventId) =>
    server.inject({
      method: "POST",
      url: `/api/events/${targetEventId}/participants/${id}/claim`,
    });

  const unclaim = (id: string, token?: string) =>
    server.inject({
      method: "DELETE",
      url: `/api/events/${eventId}/participants/${id}/claim`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const setMode = (id: string, token: string, travelMode: string) =>
    server.inject({
      method: "PATCH",
      url: `/api/events/${eventId}/participants/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { travelMode },
    });

  const vote = (id: string, token: string) =>
    server.inject({
      method: "POST",
      url: `/api/events/${eventId}/participants/${id}/votes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        venueId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        venueData: {
          name: "Cozy Cafe",
          address: "789 Pine Rd, New York, NY",
          lat: 40.7484,
          lng: -73.9857,
        },
      },
    });

  const publish = () =>
    server.db.event.update({ where: { id: eventId }, data: { publishedAt: new Date() } });

  const claimableInEvent = async (id: string) => {
    const event = await server.inject({ method: "GET", url: `/api/events/${eventId}` });
    return event.json().participants.find((p: { id: string }) => p.id === id).claimable;
  };

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    broadcastMock = vi.fn().mockResolvedValue(undefined);
    server.sse.broadcast = broadcastMock;

    const event = (
      await server.inject({ method: "POST", url: "/api/events", payload: { title: "Dinner" } })
    ).json();
    eventId = event.id;
    organizerToken = event.participantToken;
    organizerId = event.organizerParticipantId;
    addedId = (await addParticipant("Mom", organizerToken)).id;
    broadcastMock.mockClear();
  });

  describe("POST /api/events/:id/participants/:participantId/claim", () => {
    it("gives the claimer a token that works for that row", async () => {
      const response = await claim(addedId);

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({ id: addedId, name: "Mom", claimable: false });
      expect(body.participantToken).toMatch(/^pt_/);
      expect(response.body).not.toMatch(/tokenHash|token_hash/);

      const me = await server.inject({
        method: "GET",
        url: `/api/events/${eventId}/me`,
        headers: { authorization: `Bearer ${body.participantToken}` },
      });
      expect(me.json()).toMatchObject({ participantId: addedId, isOrganizer: false });

      const modeChange = await setMode(addedId, body.participantToken, "transit");
      expect(modeChange.json().travelMode).toBe("transit");
    });

    it("makes the row not claimable and takes the mode away from the organizer", async () => {
      await claim(addedId);

      expect(await claimableInEvent(addedId)).toBe(false);
      expect((await setMode(addedId, organizerToken, "walking")).statusCode).toBe(403);
    });

    it("broadcasts participant:updated", async () => {
      await claim(addedId);

      expect(broadcastMock).toHaveBeenCalledOnce();
      expect(broadcastMock).toHaveBeenCalledWith({
        eventId,
        type: "participant:updated",
        payload: {
          participant: expect.objectContaining({ id: addedId, claimable: false }),
        },
      });
    });

    it("lets exactly one of several concurrent claims win", async () => {
      const responses = await Promise.all(Array.from({ length: 8 }, () => claim(addedId)));

      const statuses = responses.map((r) => r.statusCode).sort();
      expect(statuses).toEqual([200, 409, 409, 409, 409, 409, 409, 409]);

      const winner = responses.find((r) => r.statusCode === 200);
      const modeChange = await setMode(addedId, winner?.json().participantToken, "walking");
      expect(modeChange.statusCode).toBe(200);
    });

    it("refuses a second claim", async () => {
      await claim(addedId);

      const response = await claim(addedId);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "PARTICIPANT_NOT_CLAIMABLE");
    });

    it("refuses the organizer's row", async () => {
      const response = await claim(organizerId);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "PARTICIPANT_NOT_CLAIMABLE");
    });

    it("refuses a row that joined with its own token", async () => {
      const joined = await addParticipant("Joined");

      expect((await claim(joined.id)).statusCode).toBe(409);
    });

    it("refuses on a published event", async () => {
      await publish();

      const response = await claim(addedId);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
      expect(await claimableInEvent(addedId)).toBe(true);
    });

    it("returns 404 for an unknown participant", async () => {
      const response = await claim(randomUUID());

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty("error.code", "PARTICIPANT_NOT_FOUND");
    });

    it("returns 404 for a row in another event", async () => {
      const other = (
        await server.inject({ method: "POST", url: "/api/events", payload: { title: "Other" } })
      ).json();

      const response = await claim(addedId, other.id);

      expect(response.statusCode).toBe(404);
      expect(await claimableInEvent(addedId)).toBe(true);
    });

    it("returns 404 for an unknown event", async () => {
      const response = await claim(addedId, "evt_1234567890123_abcdefghij123456");

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty("error.code", "EVENT_NOT_FOUND");
    });

    it("returns 400 for a malformed participant ID", async () => {
      expect((await claim("not-a-uuid")).statusCode).toBe(400);
    });
  });

  describe("DELETE /api/events/:id/participants/:participantId/claim", () => {
    let token: string;

    beforeEach(async () => {
      token = (await claim(addedId)).json().participantToken;
      broadcastMock.mockClear();
    });

    it("makes the row claimable, removes its votes and retires the token", async () => {
      expect((await vote(addedId, token)).statusCode).toBe(201);

      const response = await unclaim(addedId, token);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: addedId, claimable: true });
      expect(await claimableInEvent(addedId)).toBe(true);
      expect(await server.db.vote.count({ where: { participantId: addedId } })).toBe(0);
      expect((await setMode(addedId, token, "walking")).statusCode).toBe(403);
    });

    it("keeps the mode and hands it back to the organizer", async () => {
      await setMode(addedId, token, "transit");

      const response = await unclaim(addedId, token);

      expect(response.json().travelMode).toBe("transit");
      expect((await setMode(addedId, organizerToken, "walking")).statusCode).toBe(200);
    });

    it("lets someone else claim the row afterwards with a different token", async () => {
      await unclaim(addedId, token);

      const again = await claim(addedId);

      expect(again.statusCode).toBe(200);
      expect(again.json().participantToken).not.toBe(token);
    });

    it("broadcasts participant:updated and a vote:statistics snapshot", async () => {
      await vote(addedId, token);
      await vi.waitFor(() =>
        expect(
          broadcastMock.mock.calls.filter(([call]) => call.type === "vote:statistics")
        ).toHaveLength(1)
      );
      broadcastMock.mockClear();

      await unclaim(addedId, token);

      await vi.waitFor(() => expect(broadcastMock).toHaveBeenCalledTimes(2));
      const byType = Object.fromEntries(
        broadcastMock.mock.calls.map(([call]) => [call.type, call.payload])
      );
      expect(byType["participant:updated"].participant).toMatchObject({
        id: addedId,
        claimable: true,
      });
      expect(byType["vote:statistics"]).toMatchObject({ totalVotes: 0, venues: [] });
    });

    it("frees the row for the next claimer's account", async () => {
      const register = async (email: string) => {
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { email, password: "password123", name: "Claimer" },
        });
        return response.cookies.find((c) => c.name === "session_token")?.value ?? "";
      };
      const link = (session: string, participantToken: string) =>
        server.inject({
          method: "POST",
          url: "/api/users/me/events/claim",
          cookies: { session_token: session },
          payload: { eventId, participantToken },
        });

      const first = await register(`first-${randomUUID()}@example.com`);
      expect((await link(first, token)).statusCode).toBe(201);

      await unclaim(addedId, token);
      const nextToken = (await claim(addedId)).json().participantToken;

      const second = await register(`second-${randomUUID()}@example.com`);
      expect((await link(second, nextToken)).statusCode).toBe(201);
    });

    it("refuses a request with no token", async () => {
      expect((await unclaim(addedId)).statusCode).toBe(401);
    });

    it("refuses another participant's token", async () => {
      const other = await addParticipant("Other");

      expect((await unclaim(addedId, other.participantToken)).statusCode).toBe(403);
      expect(await claimableInEvent(addedId)).toBe(false);
    });

    it("refuses an organizer token for a different row", async () => {
      expect((await unclaim(addedId, organizerToken)).statusCode).toBe(403);
      expect(await claimableInEvent(addedId)).toBe(false);
    });

    it("refuses the organizer's own row", async () => {
      expect((await unclaim(organizerId, organizerToken)).statusCode).toBe(403);
      expect(await claimableInEvent(organizerId)).toBe(false);
    });

    it("refuses on a published event and keeps the votes", async () => {
      await vote(addedId, token);
      await publish();

      const response = await unclaim(addedId, token);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toHaveProperty("error.code", "EVENT_ALREADY_PUBLISHED");
      expect(await server.db.vote.count({ where: { participantId: addedId } })).toBe(1);
    });
  });
});
