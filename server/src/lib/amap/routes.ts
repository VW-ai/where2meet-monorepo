/**
 * AMap route planning 2.0 for China events.
 *
 * Produces the same RouteResult as the Google directions module: distances in
 * meters with metric text, durations in seconds, and a Google-encoded WGS-84
 * polyline, so the directions service and client need no AMap knowledge.
 * @see https://lbs.amap.com/api/webservice/guide/api/newroute
 * @module lib/amap/routes
 */

import {
  getRouteCacheKey,
  getCachedRoute,
  cacheRoute,
  type CachedRouteData,
} from "../directions/cache.js";
import { DirectionsApiError, RouteNotFoundError } from "../directions/errors.js";
import { formatDistanceMetric, formatDuration } from "../directions/format.js";
import type { GeoPoint, RouteResult, TravelMode } from "../directions/types.js";
import type { ParticipantLocation } from "../directions/routes.js";
import type { LatLng } from "../geo/coords.js";
import { encodePolyline } from "../geo/polyline.js";
import { amapGet, withAmapRetry } from "./client.js";
import { amapReverseGeocode } from "./geocode.js";
import { fromAmapLocation, fromAmapPolyline, toAmapLocation } from "./parse.js";
import type {
  AmapPath,
  AmapPathRouteResponse,
  AmapStep,
  AmapTransit,
  AmapTransitRouteResponse,
} from "./types.js";

/** Without these fields AMap returns neither durations nor polylines. */
const SHOW_FIELDS = "cost,polyline";

const PATH_ENDPOINTS: Record<Exclude<TravelMode, "transit">, string> = {
  driving: "/v5/direction/driving",
  walking: "/v5/direction/walking",
  bicycling: "/v5/direction/bicycling",
};

const directionsError = (message: string, status: string) =>
  new DirectionsApiError(message, status);

function seconds(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Path duration, summed from the steps when the path itself has none. */
function stepsDuration(steps: AmapStep[] | undefined): number {
  return (steps ?? []).reduce((total, step) => total + seconds(step.cost?.duration), 0);
}

function stepsPath(steps: AmapStep[] | undefined): LatLng[] {
  return (steps ?? []).flatMap((step) => fromAmapPolyline(step.polyline));
}

function toCachedRoute(
  distanceMeters: number,
  durationSeconds: number,
  path: LatLng[]
): CachedRouteData {
  return {
    distanceValue: distanceMeters,
    distanceText: formatDistanceMetric(distanceMeters),
    durationValue: durationSeconds,
    durationText: formatDuration(durationSeconds),
    polyline: encodePolyline(path),
  };
}

function fromPath(path: AmapPath): CachedRouteData {
  const duration =
    path.cost?.duration !== undefined ? seconds(path.cost.duration) : stepsDuration(path.steps);
  return toCachedRoute(Number(path.distance), duration, stepsPath(path.steps));
}

/**
 * Joins a transit plan's walking, bus and rail legs into one path. Rail legs
 * have no polyline, so they are drawn stop to stop.
 */
function fromTransit(transit: AmapTransit): CachedRouteData {
  const path = (transit.segments ?? []).flatMap((segment) => [
    ...stepsPath(segment.walking?.steps),
    ...fromAmapPolyline(segment.bus?.buslines?.[0]?.polyline),
    ...[segment.railway?.departure_stop, segment.railway?.arrival_stop]
      .map((stop) => fromAmapLocation(stop?.location))
      .filter((point): point is LatLng => point !== null),
  ]);
  return toCachedRoute(Number(transit.distance), seconds(transit.cost?.duration), path);
}

/** Transit planning needs each end's city code. */
async function cityCodeOf(point: GeoPoint): Promise<string> {
  try {
    const { cityCode } = await amapReverseGeocode(point);
    if (cityCode) {
      return cityCode;
    }
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    throw new DirectionsApiError(
      `Could not find the city for transit: ${error instanceof Error ? error.message : String(error)}`,
      typeof status === "string" ? status : "UNKNOWN_ERROR"
    );
  }
  throw new DirectionsApiError("Transit is not available at this location", "ZERO_RESULTS");
}

async function fetchRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode
): Promise<CachedRouteData> {
  const ends = { origin: toAmapLocation(origin), destination: toAmapLocation(destination) };
  const notFound = () =>
    new RouteNotFoundError(
      `${String(origin.lat)},${String(origin.lng)}`,
      `${String(destination.lat)},${String(destination.lng)}`
    );

  if (mode === "transit") {
    const [city1, city2] = await Promise.all([cityCodeOf(origin), cityCodeOf(destination)]);
    const response = await amapGet<AmapTransitRouteResponse>(
      "/v5/direction/transit/integrated",
      { ...ends, city1, city2, show_fields: SHOW_FIELDS },
      directionsError
    );
    const transit = response.route?.transits?.[0];
    if (!transit) throw notFound();
    return fromTransit(transit);
  }

  const response = await amapGet<AmapPathRouteResponse>(
    PATH_ENDPOINTS[mode],
    { ...ends, show_fields: SHOW_FIELDS },
    directionsError
  );
  const path = response.route?.paths?.[0];
  if (!path) throw notFound();
  return fromPath(path);
}

/**
 * Calculates a route between two WGS-84 points.
 * @param origin - Start
 * @param destination - End
 * @param mode - Travel mode
 * @param participantId - Participant the route belongs to
 * @returns Route result in the shared format
 * @throws DirectionsApiError on API errors, including no route (status ZERO_RESULTS)
 * @throws RouteNotFoundError if AMap returns no plan
 */
export async function amapCalculateRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode,
  participantId: string
): Promise<RouteResult> {
  const cacheKey = `amap:${getRouteCacheKey(origin.lat, origin.lng, destination.lat, destination.lng, mode)}`;
  const cached = await getCachedRoute(cacheKey);
  const data = cached ?? (await withAmapRetry(() => fetchRoute(origin, destination, mode)));
  if (!cached) {
    // Cache in the background; a slow or unavailable cache must not delay the user
    void cacheRoute(cacheKey, data);
  }
  return {
    participantId,
    distance: { value: data.distanceValue, text: data.distanceText },
    duration: { value: data.durationValue, text: data.durationText },
    polyline: data.polyline,
  };
}

/**
 * Calculates routes for several participants to one venue, in parallel.
 * @param participants - Participant locations
 * @param venue - Destination
 * @param mode - Travel mode
 * @returns Successful routes; failures are logged and left out, as with Google
 */
export async function amapCalculateBatchRoutes(
  participants: ParticipantLocation[],
  venue: GeoPoint,
  mode: TravelMode
): Promise<RouteResult[]> {
  const results = await Promise.allSettled(
    participants.map((p) => amapCalculateRoute({ lat: p.lat, lng: p.lng }, venue, mode, p.id))
  );
  return results.flatMap((result, i) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }
    console.warn(
      `[AMap] Failed to calculate route for participant ${participants[i]?.id ?? "unknown"}:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason)
    );
    return [];
  });
}
