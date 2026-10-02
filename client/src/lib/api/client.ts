/**
 * Base API Client
 *
 * Provides low-level fetch functions for API calls:
 * - backendCall: Direct calls to backend (http://localhost:3000)
 * - apiCall: Calls to Next.js API routes (mock mode)
 */

// Backend URL for direct API calls
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * API Error class
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Build an APIError from a failed response's JSON body.
 *
 * The backend answers `{ error: { code, message, details? } }`. A flat
 * `{ error: 'CODE', message }` body is accepted too, so a non-standard
 * response still yields a string code instead of an object.
 */
export function apiErrorFromResponse(status: number, body: unknown): APIError {
  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const nested =
    data.error && typeof data.error === 'object' ? (data.error as Record<string, unknown>) : {};

  const code = nested.code ?? (typeof data.error === 'string' ? data.error : data.code);
  const message = nested.message ?? data.message;
  const details = nested.details ?? data.details;

  return new APIError(
    status,
    typeof code === 'string' && code ? code : 'UNKNOWN_ERROR',
    typeof message === 'string' && message ? message : `Request failed with status ${status}`,
    details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined
  );
}

/**
 * Call backend API directly
 * Used for endpoints that have been migrated to the real backend
 */
export async function backendCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${BACKEND_URL}${endpoint}`;

    // Only include Content-Type header when there's a body
    const headers: HeadersInit = {
      ...options?.headers,
    };
    if (options?.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw apiErrorFromResponse(response.status, errorData);
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) throw error;

    console.error('[Backend API] Network error:', error);
    throw new APIError(0, 'NETWORK_ERROR', 'Failed to connect to backend. Is it running?');
  }
}

/**
 * Call Next.js API routes
 * Used for endpoints still in mock mode
 */
export async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

    // Only include Content-Type header when there's a body
    const headers: HeadersInit = {
      ...options?.headers,
    };
    if (options?.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw apiErrorFromResponse(response.status, errorData);
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) throw error;

    console.error('[API] Network error:', error);
    throw new APIError(0, 'NETWORK_ERROR', 'Network request failed. Please check your connection.');
  }
}
