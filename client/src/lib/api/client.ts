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
 * Call backend API directly
 * Used for endpoints that have been migrated to the real backend
 */
export async function backendCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${BACKEND_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || `Request failed with status ${response.status}`,
        errorData.details
      );
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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || `Request failed with status ${response.status}`,
        errorData.error?.details
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) throw error;

    console.error('[API] Network error:', error);
    throw new APIError(0, 'NETWORK_ERROR', 'Network request failed. Please check your connection.');
  }
}
