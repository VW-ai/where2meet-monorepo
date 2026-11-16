/**
 * Google Sign-In Handler
 * POST /api/auth/google - Exchange a Google ID token for a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeAuthUserRequest } from '@/lib/api/auth-user-router';

async function handleGoogleMock(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'GOOGLE_SIGNIN_DISABLED',
        message: 'Google sign-in is not available in mock mode',
      },
    },
    { status: 503 }
  );
}

export async function handleGoogle(request: NextRequest): Promise<NextResponse> {
  return routeAuthUserRequest(request, 'auth', '/google', handleGoogleMock);
}
