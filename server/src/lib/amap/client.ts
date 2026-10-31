/**
 * AMap Web Service HTTP client with timeout and retry.
 * @module lib/amap/client
 */

import { config } from "../config.js";
import { statusForInfocode, type AmapErrorFactory } from "./errors.js";
import type { AmapEnvelope } from "./types.js";

const AMAP_BASE_URL = "https://restapi.amap.com";

/**
 * Calls an AMap endpoint and checks its status.
 * @param path - Endpoint path, e.g. "/v5/place/around"
 * @param params - Query parameters (the key is added here)
 * @param makeError - Builds the shared error class the caller throws
 * @returns Parsed response with status "1"
 * @throws The factory's error on HTTP errors, AMap errors or a missing key
 */
export async function amapGet<T extends AmapEnvelope>(
  path: string,
  params: Record<string, string>,
  makeError: AmapErrorFactory
): Promise<T> {
  if (!isAmapConfigured()) {
    throw makeError("AMap is not configured", "REQUEST_DENIED");
  }

  const query = new URLSearchParams({ ...params, key: config.AMAP_WEB_SERVICE_KEY });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.AMAP_TIMEOUT_MS);

  try {
    const response = await fetch(`${AMAP_BASE_URL}${path}?${query.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw makeError(
        `HTTP error: ${String(response.status)} ${response.statusText}`,
        "HTTP_ERROR"
      );
    }
    const body = (await response.json()) as T;
    if (body.status !== "1") {
      throw makeError(`AMap error: ${body.info}`, statusForInfocode(body.infocode));
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retries rate limits, HTTP errors, timeouts and network failures. Errors with
 * any other status (denied, invalid, no results) and not-found errors fail at once.
 */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "string") {
    return status === "OVER_QUERY_LIMIT" || status === "HTTP_ERROR";
  }
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an AMap call with exponential backoff (100ms, 400ms).
 * @param operation - The call to retry
 * @returns The operation's result
 * @throws The last error once retries are exhausted
 */
export async function withAmapRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      const delayMs = 100 * Math.pow(4, attempt);
      console.warn(
        `[AMap] Attempt ${String(attempt + 1)} failed, retrying in ${String(delayMs)}ms:`,
        error instanceof Error ? error.message : error
      );
      await delay(delayMs);
    }
  }
  throw lastError;
}

/**
 * Checks whether an AMap Web Service key is configured.
 * @returns True if AMAP_WEB_SERVICE_KEY is set
 */
export function isAmapConfigured(): boolean {
  return config.AMAP_WEB_SERVICE_KEY.length > 0;
}
