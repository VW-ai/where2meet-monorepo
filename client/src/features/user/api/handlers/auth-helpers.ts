/**
 * Shared authentication helpers for user API handlers
 */

import { NextRequest } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { SessionsData, Session, UsersData } from '@/features/auth/types';

/**
 * Helper to get user from session token
 */
export async function getUserFromSession(request: NextRequest) {
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
