/**
 * User Profile API Routes
 * GET /api/users/me - Get current user profile
 * PATCH /api/users/me - Update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { SessionsData, Session, UsersData, User } from '@/types/user';

/**
 * Helper to get user from session token
 */
async function getUserFromSession(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
      status: 401,
    };
  }

  const sessionsData = (await authPersistence.getSessions()) as SessionsData;
  const sessionEntry = Object.values(sessionsData.sessions).find(
    (session: Session) => session.sessionToken === sessionToken
  );

  if (!sessionEntry) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid session',
      },
      status: 401,
    };
  }

  const session = sessionEntry;

  if (new Date(session.expiresAt) < new Date()) {
    return {
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session has expired',
      },
      status: 401,
    };
  }

  const usersData = (await authPersistence.getUsers()) as UsersData;
  const user = usersData.users[session.userId];

  if (!user) {
    return {
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
      status: 404,
    };
  }

  return { user, userId: session.userId };
}

export async function GET(request: NextRequest) {
  try {
    const result = await getUserFromSession(request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    console.error('[API] Error getting user profile:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get profile',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await getUserFromSession(request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { user, userId } = result as { user: User; userId: string };

    // Parse update data
    const body = await request.json();
    const { name, defaultAddress, defaultPlaceId, defaultFuzzyLocation, avatarUrl } = body;

    // Update user
    const usersData = (await authPersistence.getUsers()) as UsersData;
    const updatedUser = {
      ...user,
      name: name !== undefined ? name : user.name,
      defaultAddress: defaultAddress !== undefined ? defaultAddress : user.defaultAddress,
      defaultPlaceId: defaultPlaceId !== undefined ? defaultPlaceId : user.defaultPlaceId,
      defaultFuzzyLocation:
        defaultFuzzyLocation !== undefined ? defaultFuzzyLocation : user.defaultFuzzyLocation,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : user.avatarUrl,
      updatedAt: new Date().toISOString(),
    };

    usersData.users[userId] = updatedUser;
    await authPersistence.saveUsers(usersData);

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[API] Error updating user profile:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update profile',
        },
      },
      { status: 500 }
    );
  }
}
