/**
 * Unit tests for map provider selection in the services.
 *
 * AMap events must reach the AMap module for geocoding, search and routes,
 * and AMap venue IDs must reach it for details, without touching Google.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

vi.mock("../../src/lib/amap/index.js", () => ({
  isAmapVenueId: (id: string) => id.startsWith("amap:"),
  amapGeocode: vi.fn(),
  amapSearchNearby: vi.fn(),
  amapTextSearch: vi.fn(),
  amapGetDetails: vi.fn(),
  amapCalculateBatchRoutes: vi.fn(),
}));

vi.mock("../../src/lib/places/index.js", async () => {
  const actual = await vi.importActual("../../src/lib/places/index.js");
  return {
    ...actual,
    searchNearbyPlaces: vi.fn(),
    textSearchPlaces: vi.fn(),
    getPlaceDetails: vi.fn(),
  };
});

vi.mock("../../src/lib/maps.js", async () => {
  const actual = await vi.importActual("../../src/lib/maps.js");
  return { ...actual, geocode: vi.fn() };
});

vi.mock("../../src/lib/directions/index.js", async () => {
  const actual = await vi.importActual("../../src/lib/directions/index.js");
  return { ...actual, calculateBatchRoutes: vi.fn() };
});

vi.mock("../../src/lib/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  amapGeocode,
  amapSearchNearby,
  amapTextSearch,
  amapGetDetails,
  amapCalculateBatchRoutes,
} from "../../src/lib/amap/index.js";
import {
  searchNearbyPlaces,
  textSearchPlaces,
  getPlaceDetails,
  PlacesApiError,
} from "../../src/lib/places/index.js";
import { geocode } from "../../src/lib/maps.js";
import { calculateBatchRoutes } from "../../src/lib/directions/index.js";
import { VenueService } from "../../src/services/venue.js";
import { ParticipantService } from "../../src/services/participant.js";
import { DirectionsService } from "../../src/services/directions.js";
import { toVenueResponse } from "../../src/mappers/venue.mapper.js";

const EVENT_ID = "evt_1702000000000_abcdefghijklmnop";
const BEIJING = { lat: 39.9087, lng: 116.4607 };

function amapPlace() {
  return {
    placeId: "amap:B0FFXXXXXX",
    name: "星巴克",
    address: "三里屯路19号",
    location: BEIJING,
    types: ["cafe", "point_of_interest"],
    rating: 4.5,
    userRatingsTotal: null,
    priceLevel: 1,
    openNow: null,
    photoReference: "https://store.is.autonavi.com/showpic/abc",
    formattedPhoneNumber: null,
    website: null,
    openingHours: null,
  };
}

function createMockPrisma() {
  return {
    event: { findUnique: vi.fn() },
    venue: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
    participant: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient;
}

describe("map provider selection", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe("VenueService", () => {
    it("searches AMap for AMap events", async () => {
      vi.mocked(amapTextSearch).mockResolvedValue([amapPlace()]);
      vi.mocked(amapSearchNearby).mockResolvedValue([]);

      const result = await new VenueService(mockPrisma).searchVenues(BEIJING, 3000, {
        query: "咖啡",
        categories: ["cafe"],
        mapProvider: "amap",
      });

      expect(result.places).toHaveLength(1);
      expect(amapTextSearch).toHaveBeenCalledWith("咖啡", BEIJING, 3000);
      expect(amapSearchNearby).toHaveBeenCalledWith(BEIJING, 3000, "cafe");
      expect(textSearchPlaces).not.toHaveBeenCalled();
      expect(searchNearbyPlaces).not.toHaveBeenCalled();
    });

    it("keeps Google for searches without a provider", async () => {
      vi.mocked(searchNearbyPlaces).mockResolvedValue([]);

      await new VenueService(mockPrisma).searchVenues(BEIJING, 3000, { categories: ["cafe"] });

      expect(searchNearbyPlaces).toHaveBeenCalledWith(BEIJING, 3000, { type: "cafe" });
      expect(amapSearchNearby).not.toHaveBeenCalled();
    });

    it("turns AMap search errors into a 502", async () => {
      vi.mocked(amapTextSearch).mockRejectedValue(new PlacesApiError("quota", "OVER_DAILY_LIMIT"));

      const error = await new VenueService(mockPrisma)
        .searchVenues(BEIJING, 3000, { query: "咖啡", mapProvider: "amap" })
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ statusCode: 502, code: "EXTERNAL_SERVICE_ERROR" });
    });

    it("fetches AMap venue details by ID and caches the AMap photo URL as is", async () => {
      vi.mocked(amapGetDetails).mockResolvedValue(amapPlace());

      await new VenueService(mockPrisma).getVenueDetails("amap:B0FFXXXXXX");

      expect(amapGetDetails).toHaveBeenCalledWith("amap:B0FFXXXXXX");
      expect(getPlaceDetails).not.toHaveBeenCalled();
      expect(mockPrisma.venue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            photoUrl: "https://store.is.autonavi.com/showpic/abc",
          }),
        })
      );
    });
  });

  describe("venue mapper", () => {
    it("returns AMap photo URLs unchanged", () => {
      expect(toVenueResponse(amapPlace()).photoUrl).toBe(
        "https://store.is.autonavi.com/showpic/abc"
      );
    });
  });

  describe("ParticipantService", () => {
    it("geocodes with the event's provider", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        publishedAt: null,
        mapProvider: "amap",
      } as never);
      vi.mocked(amapGeocode).mockResolvedValue({ ...BEIJING, formattedAddress: "北京市朝阳区" });
      vi.mocked(mockPrisma.participant.create).mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000",
        eventId: EVENT_ID,
        name: "小明",
        address: "国贸",
        formattedAddress: "北京市朝阳区",
        lat: new Decimal(BEIJING.lat),
        lng: new Decimal(BEIJING.lng),
        color: "coral",
        isOrganizer: false,
        createdAt: new Date(),
      } as never);

      await new ParticipantService(mockPrisma).addParticipant(EVENT_ID, {
        name: "小明",
        address: "国贸",
      });

      expect(amapGeocode).toHaveBeenCalledWith("国贸");
      expect(geocode).not.toHaveBeenCalled();
    });
  });

  describe("DirectionsService", () => {
    it("routes AMap events through AMap", async () => {
      vi.mocked(mockPrisma.event.findUnique).mockResolvedValue({
        id: EVENT_ID,
        mapProvider: "amap",
        participants: [
          {
            id: "p1",
            lat: new Decimal(39.9334),
            lng: new Decimal(116.4479),
          },
        ],
      } as never);
      vi.mocked(mockPrisma.venue.findUnique).mockResolvedValue({
        id: "amap:B0FFXXXXXX",
        lat: new Decimal(BEIJING.lat),
        lng: new Decimal(BEIJING.lng),
      } as never);
      vi.mocked(amapCalculateBatchRoutes).mockResolvedValue([]);

      await new DirectionsService(mockPrisma).getDirections(
        EVENT_ID,
        "amap:B0FFXXXXXX",
        "walking"
      );

      expect(amapCalculateBatchRoutes).toHaveBeenCalledWith(
        [{ id: "p1", lat: 39.9334, lng: 116.4479 }],
        BEIJING,
        "walking"
      );
      expect(calculateBatchRoutes).not.toHaveBeenCalled();
    });
  });
});
