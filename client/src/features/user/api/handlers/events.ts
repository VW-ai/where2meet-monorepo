/**
 * User Events Handler
 * GET /api/users/me/events - Get all events for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeAuthUserRequest } from '@/lib/api/auth-user-router';
import { authPersistence } from '@/mock-server/auth-persistence';
import { loadData } from '@/mock-server/services/persistence';
import { SessionsData, Session, UserEventsData, UserEvent } from '@/features/auth/types';

/**
 * Mock implementation - uses local file storage
 */
async function handleGetUserEventsMock(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify session and get user
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

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

    const session = sessionEntry;

    if (new Date(session.expiresAt) < new Date()) {
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

    const userId = session.userId;

    // Get user's events
    const userEventsData = (await authPersistence.getUserEvents()) as UserEventsData;
    const userEvents = Object.values(userEventsData.userEvents).filter(
      (ue: UserEvent) => ue.userId === userId
    );

    // Load events data
    const eventsData = await loadData();

    // Map user events to full event objects
    const events = userEvents
      .map((ue: UserEvent) => {
        const event = eventsData.events[ue.eventId];
        if (!event) return null;

        return {
          ...event,
          // Don't include sensitive tokens in the response
          organizerToken: undefined,
          organizerParticipantId: undefined,
        };
      })
      .filter((event) => event !== null);

    return NextResponse.json(events);
  } catch (error) {
    console.error('[API] Error getting user events:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get user events',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Main handler - routes to mock or real backend based on configuration
 */
export async function handleGetUserEvents(request: NextRequest): Promise<NextResponse> {
  return routeAuthUserRequest(request, 'users', '/me/events', handleGetUserEventsMock);
}
