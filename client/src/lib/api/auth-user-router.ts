/**
 * Auth & User API Router
 * Automatically routes requests to mock or real backend based on environment configuration
 */

import { NextRequest, NextResponse } from 'next/server';

// Read configuration from environment variables
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE || 'off';
const MOCK_DOMAINS = process.env.NEXT_PUBLIC_MOCK_DOMAINS || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Check if a specific domain should use mock
 */
function shouldMockDomain(domain: 'auth' | 'users' | 'events' | 'venues'): boolean {
  // If mock mode is off, never mock
  if (MOCK_MODE === 'off') {
    return false;
  }

  // If mock mode is full, always mock
  if (MOCK_MODE === 'full') {
    return true;
  }

  // If mock mode is partial, check if domain is in the list
  if (MOCK_MODE === 'partial') {
    const domains = MOCK_DOMAINS.split(',').map((d) => d.trim());
    return domains.includes(domain);
  }

  return false;
}

/**
 * Proxy request to real backend
 */
async function proxyToBackend(request: NextRequest, endpoint: string): Promise<NextResponse> {
  try {
    const method = request.method;
    const url = `${BACKEND_URL}${endpoint}`;

    console.warn(`[Auth Router] Proxying to backend: ${method} ${url}`);

    // Prepare headers
    const headers: Record<string, string> = {};

    // Forward cookies to backend
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Forward authorization header if present
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    // Add body for POST/PATCH/PUT requests
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
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

    // Create Next response with same status
    const nextResponse = NextResponse.json(data, { status: response.status });

    // Forward Set-Cookie headers from backend
    const setCookieHeaders = response.headers.get('set-cookie');
    if (setCookieHeaders) {
      // Parse and set cookies
      const cookies = setCookieHeaders.split(', ');
      cookies.forEach((cookie) => {
        const [nameValue, ...attributes] = cookie.split('; ');
        const [name, value] = nameValue.split('=');

        // Parse cookie attributes
        const cookieOptions: {
          httpOnly: boolean;
          secure: boolean;
          sameSite: 'lax';
          path: string;
          maxAge?: number;
        } = {
          httpOnly: attributes.includes('HttpOnly'),
          secure: attributes.includes('Secure'),
          sameSite: 'lax' as const,
          path: '/',
        };

        // Extract maxAge if present
        const maxAgeAttr = attributes.find((attr) => attr.startsWith('Max-Age='));
        if (maxAgeAttr) {
          cookieOptions.maxAge = parseInt(maxAgeAttr.split('=')[1]);
        }

        nextResponse.cookies.set(name, value, cookieOptions);
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('[Auth Router] Error proxying to backend:', error);
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
 * Route auth or user request to appropriate handler
 */
export async function routeAuthUserRequest(
  request: NextRequest,
  domain: 'auth' | 'users',
  endpoint: string,
  mockHandler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const useMock = shouldMockDomain(domain);

  if (useMock) {
    console.warn(`[Auth Router] Using MOCK for ${domain}${endpoint}`);
    return mockHandler(request);
  } else {
    console.warn(`[Auth Router] Using REAL BACKEND for ${domain}${endpoint}`);
    return proxyToBackend(request, `/api/${domain}${endpoint}`);
  }
}

/**
 * Export configuration check functions for debugging
 */
export function getRouterConfig() {
  return {
    mockMode: MOCK_MODE,
    mockDomains: MOCK_DOMAINS,
    backendUrl: BACKEND_URL,
    authUseMock: shouldMockDomain('auth'),
    usersUseMock: shouldMockDomain('users'),
  };
}
