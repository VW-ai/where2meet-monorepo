/**
 * Server-side API Proxy
 * Routes API calls to either mock store or real backend based on environment variable
 */

import { NextRequest, NextResponse } from 'next/server';

const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Proxy a request to the real backend server
 */
export async function proxyToBackend(
  request: NextRequest,
  endpoint: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<NextResponse> {
  try {
    const method = options?.method || request.method;
    const url = `${BACKEND_URL}${endpoint}`;

    console.log(`[Proxy] ${method} ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward authorization header if present
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PATCH/PUT requests
    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    } else if (method !== 'GET' && method !== 'DELETE') {
      // Try to get body from request
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON
      }
    }

    const response = await fetch(url, fetchOptions);

    // Parse response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : {};
    }

    // Return response with same status
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Proxy] Error proxying request:', error);
    return NextResponse.json(
      {
        error: {
          code: 'PROXY_ERROR',
          message: 'Failed to connect to backend server',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 502 }
    );
  }
}

/**
 * Check if we should use mock API
 */
export function shouldUseMockAPI(): boolean {
  return USE_MOCK_API;
}
