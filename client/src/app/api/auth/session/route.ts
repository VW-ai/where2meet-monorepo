/**
 * Session API Route
 * GET /api/auth/session - Get current user from session
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { SessionsData, Session, UsersData } from '@/types/user';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'No session found',
          },
        },
        { status: 401 }
      );
    }

    // Find session
    const sessionsData = (await authPersistence.getSessions()) as SessionsData;
    const sessionEntry = Object.values(sessionsData.sessions).find(
      (session: Session) => session.sessionToken === sessionToken
    );

    if (!sessionEntry) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid session',
          },
        },
        { status: 401 }
      );
    }

    // Check if session is expired
    const session = sessionEntry;
    if (new Date(session.expiresAt) < new Date()) {
      // Session expired, delete it
      const sessionId = session.id;
      delete sessionsData.sessions[sessionId];
      await authPersistence.saveSessions(sessionsData);

      return NextResponse.json(
        {
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          },
        },
        { status: 401 }
      );
    }

    // Get user
    const usersData = (await authPersistence.getUsers()) as UsersData;
    const user = usersData.users[session.userId];

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[API] Error getting session:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get session',
        },
      },
      { status: 500 }
    );
  }
}
