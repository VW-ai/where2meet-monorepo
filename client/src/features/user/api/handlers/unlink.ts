/**
 * Unlink Identity Handler
 * POST /api/users/me/identities/unlink - Unlink an authentication provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeAuthUserRequest } from '@/lib/api/auth-user-router';
import { authPersistence } from '@/mock-server/auth-persistence';
import { cookies } from 'next/headers';
import { SessionsData, Session, UsersData, UserIdentity } from '@/features/auth/types';

/**
 * Mock implementation - uses local file storage
 */
async function handleUnlinkIdentityMock(request: NextRequest): Promise<NextResponse> {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Find session
    const sessionsData = (await authPersistence.getSessions()) as SessionsData;
    const session = Object.values(sessionsData.sessions).find(
      (s: Session) => s.sessionToken === sessionToken
    );

    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
        { status: 401 }
      );
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: { code: 'SESSION_EXPIRED', message: 'Session has expired' } },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Get provider from request body
    const body = await request.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Provider is required' } },
        { status: 400 }
      );
    }

    // Get user's identities
    const usersData = (await authPersistence.getUsers()) as UsersData;
    const userIdentities = Object.entries(usersData.identities).filter(
      ([_, ident]: [string, UserIdentity]) => ident.userId === userId
    );

    // Check if user has more than one identity
    if (userIdentities.length <= 1) {
      return NextResponse.json(
        {
          error: {
            code: 'CANNOT_UNLINK_LAST',
            message: 'Cannot disconnect last authentication method',
          },
        },
        { status: 400 }
      );
    }

    // Find identity to remove
    const identityToRemove = userIdentities.find(
      ([_, ident]: [string, UserIdentity]) => ident.provider === provider
    );

    if (!identityToRemove) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Identity not found' } },
        { status: 404 }
      );
    }

    // Remove identity
    const [identityId] = identityToRemove;
    delete usersData.identities[identityId];
    await authPersistence.saveUsers(usersData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking identity:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to unlink identity' } },
      { status: 500 }
    );
  }
}

/**
 * Main handler - routes to mock or real backend based on configuration
 */
export async function handleUnlinkIdentity(request: NextRequest): Promise<NextResponse> {
  return routeAuthUserRequest(request, 'users', '/me/identities/unlink', handleUnlinkIdentityMock);
}
