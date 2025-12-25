/**
 * Google Directions API HTTP client with retry logic.
 * @module lib/directions/client
 */

import { config } from "../config.js";
import { DirectionsApiError, RouteNotFoundError } from "./errors.js";
import type { GoogleDirectionsResponse } from "./types.js";

/**
 * Delays execution for a specified duration.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable.
 * - RouteNotFoundError: Not retryable (no route exists)
 * - OVER_QUERY_LIMIT: Retryable (rate limiting)
 * - REQUEST_DENIED, INVALID_REQUEST: Not retryable (configuration issues)
 * - Network errors, timeouts: Retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof RouteNotFoundError) {
    return false;
  }
  if (error instanceof DirectionsApiError) {
    // Only retry on rate limits
    return error.status === "OVER_QUERY_LIMIT";
  }
  // Network errors and timeouts are retryable
  return true;
}

/**
 * Fetches from Google Directions API with timeout.
 * @param url - The full URL to fetch
 * @returns Parsed JSON response
 * @throws DirectionsApiError on HTTP errors
 */
export async function fetchDirectionsApi(url: string): Promise<GoogleDirectionsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.DIRECTIONS_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new DirectionsApiError(
        `HTTP error: ${String(response.status)} ${response.statusText}`,
        "HTTP_ERROR"
      );
    }

    return (await response.json()) as GoogleDirectionsResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes API call with exponential backoff retry.
 * Retry delays: 100ms → 400ms → 1600ms
 * @param operation - The async operation to retry
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 100;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(4, attempt);
        console.warn(
          `[Directions] Attempt ${String(attempt + 1)} failed, retrying in ${String(delayMs)}ms:`,
          error instanceof Error ? error.message : error
        );
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}
