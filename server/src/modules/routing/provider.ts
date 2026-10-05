import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { ProviderCache } from "../../cache.js";
import type { OriginOutcome, Point, RouteOutcome, Routing, TravelMode } from "./types.js";

function validPolyline(encoded: string): boolean {
  let index = 0;
  const coordinates = [0, 0];
  let coordinate = 0;
  while (index < encoded.length) {
    let value = 0;
    let multiplier = 1;
    let ended = false;
    for (let group = 0; group < 7 && index < encoded.length; group++) {
      const digit = encoded.charCodeAt(index++) - 63;
      if (digit < 0 || digit > 63) return false;
      value += (digit % 32) * multiplier;
      multiplier *= 32;
      if (digit < 32) {
        ended = true;
        break;
      }
    }
    if (!ended) return false;
    const position = coordinate % 2;
    const next = (coordinates[position] ?? 0) + (value % 2 ? -(value + 1) / 2 : value / 2);
    if (Math.abs(next) > (position === 0 ? 90 : 180) * 100000) return false;
    coordinates[position] = next;
    coordinate++;
  }
  return coordinate >= 2 && coordinate % 2 === 0;
}

const route = z.object({
  meters: z.number().nonnegative(),
  seconds: z.number().nonnegative(),
  polyline: z.string().min(1).max(1000000).refine(validPolyline),
});
const providerRoute = z.object({
  status: z.literal("OK"),
  routes: z
    .tuple([
      z.object({
        legs: z
          .tuple([
            z.object({
              distance: z.object({ value: z.number().nonnegative() }),
              duration: z.object({ value: z.number().nonnegative() }),
            }),
          ])
          .rest(z.unknown()),
        overview_polyline: z.object({ points: route.shape.polyline }),
      }),
    ])
    .rest(z.unknown()),
});
const noRoute = z.object({
  status: z.enum(["ZERO_RESULTS", "NOT_FOUND"]),
  routes: z.array(z.unknown()).length(0),
});
const providerStatus = z.object({ status: z.string() });

function cachedRoute(text: string) {
  try {
    const payload: unknown = JSON.parse(text);
    const parsed = z.object({ version: z.literal(1), value: route }).safeParse(payload);
    return parsed.success ? parsed.data.value : null;
  } catch {
    return null;
  }
}

export function createRouting(options: {
  apiKey: string;
  endpoint: string;
  timeoutMs: number;
  ttlSeconds: number;
  cache: ProviderCache;
}): Routing {
  async function calculate(
    origin: Point,
    destination: Point,
    mode: TravelMode,
    signal: AbortSignal
  ): Promise<RouteOutcome> {
    const inputs = [
      options.endpoint,
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
      mode,
    ];
    const key = `m3:routing:v1:${createHash("sha256").update(JSON.stringify(inputs)).digest("hex")}`;
    const cached = await options.cache.read(key, signal);
    if (cached !== null) {
      const value = cachedRoute(cached);
      if (value) return { kind: "found", ...value };
    }
    if (!options.apiKey || signal.aborted) return { kind: "unavailable" };
    const url = new URL(options.endpoint);
    url.searchParams.set("origin", `${String(origin.lat)},${String(origin.lng)}`);
    url.searchParams.set("destination", `${String(destination.lat)},${String(destination.lng)}`);
    url.searchParams.set("mode", mode);
    url.searchParams.set("key", options.apiKey);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, { signal, redirect: "error" });
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status !== 429 && response.status < 500) return { kind: "unavailable" };
          } else {
            const text = await response.text();
            let payload: unknown;
            try {
              payload = JSON.parse(text);
            } catch {
              return { kind: "unavailable" };
            }
            const status = providerStatus.safeParse(payload);
            if (
              !status.success ||
              !["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"].includes(status.data.status)
            ) {
              if (noRoute.safeParse(payload).success) return { kind: "no-route" };
              const parsed = providerRoute.safeParse(payload);
              if (!parsed.success) return { kind: "unavailable" };
              const first = parsed.data.routes[0];
              const value = {
                meters: first.legs[0].distance.value,
                seconds: first.legs[0].duration.value,
                polyline: first.overview_polyline.points,
              };
              await options.cache.write(
                key,
                JSON.stringify({ version: 1, value }),
                options.ttlSeconds,
                signal
              );
              return { kind: "found", ...value };
            }
          }
        } catch {
          signal.throwIfAborted();
        }
        if (attempt < 2) await delay(attempt === 0 ? 100 : 400, undefined, { signal });
      }
    } catch {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  }

  return {
    async toDestination({ origins, destination, mode }) {
      const signal = AbortSignal.timeout(options.timeoutMs);
      const results: OriginOutcome[] = origins.map(({ originId }) => ({
        originId,
        kind: "unavailable",
      }));
      const work = origins.entries();
      async function worker() {
        for (const [index, origin] of work) {
          if (signal.aborted) return;
          results[index] = {
            originId: origin.originId,
            ...(await calculate(origin.point, destination, mode, signal)),
          };
        }
      }
      await Promise.all(Array.from({ length: Math.min(origins.length, 4) }, () => worker()));
      return results;
    },
  };
}
