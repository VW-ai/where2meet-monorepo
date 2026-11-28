/**
 * GET /api/free-events lists live events that have not ended, soonest first.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

const HOUR = 3_600_000;
// Other test files share the free_event table, so this file reads and clears only its own source.
const SOURCE = "test-route";
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * HOUR);

describe("GET /api/free-events", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.db.freeEvent.deleteMany({ where: { source: SOURCE } });
    await server.close();
  });

  async function seed(
    sourceId: string,
    kind: string,
    startsAt: Date,
    endsAt: Date | null,
    status = "live"
  ) {
    await server.db.freeEvent.create({
      data: {
        source: SOURCE,
        sourceId,
        title: sourceId,
        startsAt,
        endsAt,
        kind,
        url: `https://example.org/${sourceId}`,
        status,
        lat: 40.7,
        lng: -73.9,
      },
    });
  }

  async function titles(query = "") {
    const response = await server.inject({ method: "GET", url: `/api/free-events${query}` });
    expect(response.statusCode).toBe(200);
    return (response.json() as { events: { title: string; source: string }[] }).events
      .filter((e) => e.source === SOURCE)
      .map((e) => e.title);
  }

  beforeEach(async () => {
    await server.db.freeEvent.deleteMany({ where: { source: SOURCE } });
    await seed("talk-tomorrow", "free-talk", at(24), at(26));
    await seed("hack-today", "hackathon", at(2), at(30));
    await seed("food-now", "free-food", at(-1), at(1));
    await seed("food-ended", "free-food", at(-26), at(-24));
    await seed("food-hidden", "free-food", at(3), at(4), "hidden");
    await seed("food-no-end", "free-food", at(48), null);
  });

  it("returns live events that have not ended, soonest first", async () => {
    expect(await titles()).toEqual(["food-now", "hack-today", "talk-tomorrow", "food-no-end"]);
  });

  it("filters by kind", async () => {
    expect(await titles("?kind=hackathon")).toEqual(["hack-today"]);
  });

  it("limits to events overlapping from and to", async () => {
    const from = at(20).toISOString();
    const to = at(30).toISOString();
    expect(await titles(`?from=${from}&to=${to}`)).toEqual(["hack-today", "talk-tomorrow"]);
  });

  it("serves the fields a map pin needs", async () => {
    const response = await server.inject({ method: "GET", url: "/api/free-events?kind=hackathon" });
    const events = (response.json() as { events: { source: string }[] }).events;
    expect(events.find((e) => e.source === SOURCE)).toMatchObject({
      kind: "hackathon",
      lat: 40.7,
      lng: -73.9,
      url: "https://example.org/hack-today",
      placeId: null,
    });
  });

  it.each(["?kind=party", "?from=soon", "?from=2026-12-02&to=2026-12-01"])(
    "rejects %s",
    async (query) => {
      const response = await server.inject({ method: "GET", url: `/api/free-events${query}` });
      expect(response.statusCode).toBe(400);
    }
  );
});
