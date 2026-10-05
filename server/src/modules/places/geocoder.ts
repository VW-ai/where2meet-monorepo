import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import type { GeocodeResult } from "./types.js";

const providerResult = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("OK"),
    results: z
      .tuple([
        z.object({
          formatted_address: z.string().trim().min(1).max(255),
          geometry: z.object({
            location: z.object({
              lat: z.number().min(-90).max(90),
              lng: z.number().min(-180).max(180),
            }),
          }),
        }),
      ])
      .rest(z.unknown()),
  }),
  z.object({ status: z.literal("ZERO_RESULTS"), results: z.array(z.unknown()).length(0) }),
]);
const retryableResponse = z.object({ status: z.enum(["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"]) });

async function requestGeocode(
  url: URL,
  signal: AbortSignal
): Promise<GeocodeResult | { kind: "retry" }> {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch {
    return { kind: signal.aborted ? "unavailable" : "retry" };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: response.status === 429 || response.status >= 500 ? "retry" : "unavailable" };
  }
  let body: string;
  try {
    body = await response.text();
  } catch {
    return { kind: signal.aborted ? "unavailable" : "retry" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { kind: "unavailable" };
  }
  if (retryableResponse.safeParse(payload).success) return { kind: "retry" };
  const parsed = providerResult.safeParse(payload);
  if (!parsed.success) return { kind: "unavailable" };
  if (parsed.data.status === "ZERO_RESULTS") return { kind: "not-found" };
  const result = parsed.data.results[0];
  return {
    kind: "found",
    point: result.geometry.location,
    formattedAddress: result.formatted_address,
  };
}

export function createGeocoder(options: { apiKey: string; timeoutMs: number; endpoint: string }) {
  return async (address: string): Promise<GeocodeResult> => {
    if (!options.apiKey) return { kind: "unavailable" };
    const url = new URL(options.endpoint);
    url.searchParams.set("address", address);
    url.searchParams.set("key", options.apiKey);
    const signal = AbortSignal.timeout(options.timeoutMs);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await requestGeocode(url, signal);
        if (result.kind !== "retry") return result;
        if (attempt < 2) await delay(100 * 2 ** attempt, undefined, { signal });
      }
    } catch {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  };
}
