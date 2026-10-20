/**
 * Venue search recording: a search made from a meeting adds one venue_search row.
 *
 * Rows are read with SQL so the test pins the table the usage panel reads. The search records
 * in the background, so rows are polled, and an absence is checked after a later search lands.
 */

import { setTimeout as sleep } from "node:timers/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

vi.mock("../src/lib/places/index.js", async () => {
  const actual = await vi.importActual("../src/lib/places/index.js");
  return { ...actual, textSearchPlaces: vi.fn(), searchNearbyPlaces: vi.fn() };
});

vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7484,
    lng: -73.9857,
    formattedAddress: "350 5th Ave, New York, NY 10118, USA",
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

import { PlacesApiError, searchNearbyPlaces, textSearchPlaces } from "../src/lib/places/index.js";

const UNKNOWN_EVENT_ID = "evt_1700000000000_abcdefghijklmnop";

function place(placeId: string, name: string) {
  return {
    placeId,
    name,
    address: "123 Main St, New York, NY",
    location: { lat: 40.7128, lng: -74.006 },
    types: ["cafe"],
    rating: 4.5,
    userRatingsTotal: 150,
    priceLevel: 2,
    openNow: true,
    photoReference: null,
  };
}

interface Meeting {
  eventId: string;
  organizer: { id: string; token: string };
  participant: { id: string; token: string };
}

describe("venue searches", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await server.db.$executeRawUnsafe("DROP TRIGGER IF EXISTS reject_searches ON venue_search");
    await server.db.$executeRawUnsafe("DROP FUNCTION IF EXISTS reject_search_write");
  });

  async function createMeeting(): Promise<Meeting> {
    const event = (
      await server.inject({ method: "POST", url: "/api/events", payload: { title: "Searches" } })
    ).json();
    const participant = (
      await server.inject({
        method: "POST",
        url: `/api/events/${event.id}/participants`,
        payload: { name: "Bea", address: "350 5th Ave" },
      })
    ).json();
    return {
      eventId: event.id,
      organizer: { id: event.organizerParticipantId, token: event.participantToken },
      participant: { id: participant.id, token: participant.participantToken },
    };
  }

  function search(body: Record<string, unknown>, token?: string) {
    return server.inject({
      method: "POST",
      url: "/api/venues/search",
      payload: { center: { lat: 40.7484, lng: -73.9857 }, searchRadius: 5000, ...body },
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  async function plainResponse(query: string) {
    const response = await search({ query });
    return { status: response.statusCode, body: response.json() };
  }

  const searches = (eventId: string) =>
    server.db.$queryRaw`
      SELECT participant_id, query, result_count FROM venue_search
      WHERE event_id = ${eventId} ORDER BY created_at, query`;

  const searchCount = async () =>
    (await server.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM venue_search`)[0]
      ?.n;

  it("records the query, result count and participant, and answers exactly as before", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([
      place("place_1", "Corner Cafe"),
      place("place_2", "Blue Bottle Coffee"),
    ]);
    const { eventId, participant } = await createMeeting();

    const response = await search({ eventId, query: "coffee near the park" }, participant.token);

    expect({ status: response.statusCode, body: response.json() }).toEqual(
      await plainResponse("coffee near the park")
    );
    expect(response.json().venues.map((venue: { name: string }) => venue.name)).toEqual([
      "Corner Cafe",
      "Blue Bottle Coffee",
    ]);
    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: participant.id, query: "coffee near the park", result_count: 2 },
    ]);
  });

  it("attributes the organizer's search to the organizer's participant row", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([place("place_3", "Ramen Shop")]);
    const { eventId, organizer } = await createMeeting();

    await search({ eventId, query: "ramen" }, organizer.token);

    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: organizer.id, query: "ramen", result_count: 1 },
    ]);
  });

  it("records a null participant without a token, with a bad token, or with another meeting's token", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([]);
    const meeting = await createMeeting();
    const other = await createMeeting();

    const statuses = [
      await search({ eventId: meeting.eventId, query: "a: no token" }),
      await search({ eventId: meeting.eventId, query: "b: bad token" }, "pt_not_a_real_token"),
      await search({ eventId: meeting.eventId, query: "c: other token" }, other.participant.token),
    ].map((response) => response.statusCode);

    expect(statuses).toEqual([200, 200, 200]);
    await expect.poll(() => searches(meeting.eventId)).toEqual([
      { participant_id: null, query: "a: no token", result_count: 0 },
      { participant_id: null, query: "b: bad token", result_count: 0 },
      { participant_id: null, query: "c: other token", result_count: 0 },
    ]);
  });

  it("records nothing for an unknown, malformed or missing meeting, and answers exactly as before", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([place("place_4", "Tea House")]);
    const { eventId, participant } = await createMeeting();
    const expected = await plainResponse("tea");
    const countBefore = await searchCount();

    const responses = [
      await search({ eventId: UNKNOWN_EVENT_ID, query: "tea" }, participant.token),
      await search({ eventId: "not-an-event-id", query: "tea" }, participant.token),
      await search({ eventId: 42, query: "tea" }),
      await search({ query: "tea" }, participant.token),
    ].map((response) => ({ status: response.statusCode, body: response.json() }));

    expect(responses).toEqual([expected, expected, expected, expected]);

    await search({ eventId, query: "tea" }, participant.token);
    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: participant.id, query: "tea", result_count: 1 },
    ]);
    expect(await searchCount()).toBe((countBefore ?? 0) + 1);
  });

  it("records only successful searches that carry query text", async () => {
    const { eventId, participant } = await createMeeting();

    vi.mocked(textSearchPlaces).mockRejectedValueOnce(new PlacesApiError("Places is down", "UNAVAILABLE"));
    const failed = await search({ eventId, query: "pizza" }, participant.token);
    vi.mocked(searchNearbyPlaces).mockResolvedValue([place("place_5", "Cafe")]);
    const categoriesOnly = await search({ eventId, categories: ["cafe"] }, participant.token);
    vi.mocked(textSearchPlaces).mockResolvedValue([place("place_6", "Pizza Place")]);
    const succeeded = await search({ eventId, query: "pizza" }, participant.token);

    expect([failed.statusCode, categoriesOnly.statusCode, succeeded.statusCode]).toEqual([
      502, 200, 200,
    ]);
    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: participant.id, query: "pizza", result_count: 1 },
    ]);
  });

  it("answers exactly as before when the search cannot be recorded", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([place("place_7", "Bakery")]);
    const { eventId, participant } = await createMeeting();
    await server.db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_search_write() RETURNS trigger AS $$
      BEGIN
        IF NEW.query = 'bakery' THEN RAISE EXCEPTION 'search recording is down'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await server.db.$executeRawUnsafe(`
      CREATE TRIGGER reject_searches BEFORE INSERT ON venue_search
      FOR EACH ROW EXECUTE FUNCTION reject_search_write()`);

    const response = await search({ eventId, query: "bakery" }, participant.token);

    expect({ status: response.statusCode, body: response.json() }).toEqual(
      await plainResponse("bakery")
    );
    expect(response.json().venues.map((venue: { name: string }) => venue.name)).toEqual(["Bakery"]);

    await search({ eventId, query: "bread" }, participant.token);
    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: participant.id, query: "bread", result_count: 1 },
    ]);
  });

  it("answers while the recording write is blocked, and records once the database lets it", async () => {
    vi.mocked(textSearchPlaces).mockResolvedValue([place("place_8", "Dumpling House")]);
    const { eventId, participant } = await createMeeting();
    const expected = await plainResponse("dumplings");

    const whileBlocked = await server.db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("LOCK TABLE venue_search IN EXCLUSIVE MODE");
        const response = await Promise.race([
          search({ eventId, query: "dumplings" }, participant.token),
          sleep(2000, null),
        ]);
        return {
          response: response && { status: response.statusCode, body: response.json() },
          rows: await searches(eventId),
        };
      },
      { timeout: 10_000 }
    );

    expect(whileBlocked).toEqual({ response: expected, rows: [] });
    await expect.poll(() => searches(eventId)).toEqual([
      { participant_id: participant.id, query: "dumplings", result_count: 1 },
    ]);
  });
});
