/**
 * Logout API Route
 * POST /api/auth/logout - Invalidate session and clear cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { SessionsData } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (sessionToken) {
      // Find and delete session
      const sessionsData = (await authPersistence.getSessions()) as SessionsData;
      const sessionToDelete = Object.entries(sessionsData.sessions).find(
        ([_, session]) => session.sessionToken === sessionToken
      );

      if (sessionToDelete) {
        const [sessionId] = sessionToDelete;
        delete sessionsData.sessions[sessionId];
        await authPersistence.saveSessions(sessionsData);
      }
    }

    // Clear session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Immediately expire
    });

    return response;
  } catch (error) {
    console.error('[API] Error logging out user:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to log out',
        },
      },
      { status: 500 }
    );
  }
}
