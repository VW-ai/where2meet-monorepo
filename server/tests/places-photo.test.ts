/**
 * Venue photos: clients get URLs on this API, never Google's keyed URL.
 *
 * Google is stubbed at fetch; no database is needed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Venue } from "@prisma/client";
import { Prisma } from "@prisma/client";
vi.hoisted(() => {
  process.env.GOOGLE_MAPS_API_KEY = "test-api-key";
});

import { buildServer } from "../src/server.js";
import { photoProxyUrl, publicPhotoUrl } from "../src/lib/places/index.js";
import { toVenueWithVotesResponse } from "../src/mappers/vote.mapper.js";

const IMAGE_URL = "https://lh3.googleusercontent.com/places/abc=s1600-w400";

function stubGoogle(response: Response) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

describe("GET /api/places/photo", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to Google's image host and lets clients cache it", async () => {
    const fetchSpy = stubGoogle(
      new Response(null, { status: 302, headers: { location: IMAGE_URL } })
    );

    const response = await server.inject({
      method: "GET",
      url: "/api/places/photo?ref=Ab_c-1&w=800",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(IMAGE_URL);
    expect(response.headers["cache-control"]).toBe("public, max-age=86400");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://maps.googleapis.com/maps/api/place/photo?photoreference=Ab_c-1&maxwidth=800&key=test-api-key"
    );
  });

  it("asks Google for 400 pixels when no width is given", async () => {
    const fetchSpy = stubGoogle(
      new Response(null, { status: 302, headers: { location: IMAGE_URL } })
    );

    await server.inject({ method: "GET", url: "/api/places/photo?ref=abc" });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("maxwidth=400");
  });

  it("answers 404 when Google rejects the reference", async () => {
    stubGoogle(new Response(null, { status: 400 }));

    const response = await server.inject({ method: "GET", url: "/api/places/photo?ref=gone" });

    expect(response.statusCode).toBe(404);
  });

  it("rejects a reference that is not a Google photo reference without calling Google", async () => {
    const fetchSpy = stubGoogle(
      new Response(null, { status: 302, headers: { location: IMAGE_URL } })
    );

    const response = await server.inject({
      method: "GET",
      url: "/api/places/photo?ref=abc%26key%3Dmine",
    });

    expect(response.statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("photo URLs sent to clients", () => {
  const legacyUrl =
    "https://maps.googleapis.com/maps/api/place/photo?photoreference=Ab_c-1&maxwidth=400&key=AIzaSECRET";

  it("points new photos at this API", () => {
    expect(photoProxyUrl("Ab_c-1")).toBe("http://localhost:3001/api/places/photo?ref=Ab_c-1&w=400");
  });

  it("rewrites a stored Google URL to this API, dropping the key", () => {
    expect(publicPhotoUrl(legacyUrl)).toBe(
      "http://localhost:3001/api/places/photo?ref=Ab_c-1&w=400"
    );
  });

  it("keeps other stored URLs and empty photos as they are", () => {
    expect(publicPhotoUrl("https://store.is.autonavi.com/showpic/abc")).toBe(
      "https://store.is.autonavi.com/showpic/abc"
    );
    expect(publicPhotoUrl(null)).toBeNull();
  });

  it("never sends a stored venue's key in vote results", () => {
    const venue: Venue = {
      id: "ChIJ123",
      name: "Cafe",
      address: null,
      lat: new Prisma.Decimal(40.7),
      lng: new Prisma.Decimal(-74),
      category: "cafe",
      rating: null,
      priceLevel: null,
      photoUrl: legacyUrl,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as Venue;

    expect(toVenueWithVotesResponse(venue, 1, []).photoUrl).toBe(
      "http://localhost:3001/api/places/photo?ref=Ab_c-1&w=400"
    );
  });
});
