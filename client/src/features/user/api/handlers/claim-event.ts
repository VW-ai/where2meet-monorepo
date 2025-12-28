/**
 * Claim Event Handler
 * POST /api/users/me/events/claim - Link an event to user account via token
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeAuthUserRequest } from '@/lib/api/auth-user-router';
import { authPersistence } from '@/mock-server/auth-persistence';
import { loadData } from '@/mock-server/services/persistence';
import { SessionsData, Session, UserEventsData, UserEvent } from '@/features/auth/types';

/**
 * Mock implementation - uses local file storage
 */
async function handleClaimEventMock(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify session
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

    // Get user from session
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

    // Check if session is expired
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

    // Parse request body
    const body = await request.json();
    const { eventId, participantToken } = body;

    if (!eventId || !participantToken) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'eventId and participantToken are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify event exists
    const eventsData = await loadData();
    const event = eventsData.events[eventId];

    if (!event) {
      return NextResponse.json(
        {
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Event not found',
          },
        },
        { status: 404 }
      );
    }

    // Determine role based on token
    let role: 'organizer' | 'participant' = 'participant';
    let participantId: string | null = null;

    if (event.participantToken === participantToken) {
      role = 'organizer';
      participantId = event.organizerParticipantId || null;
    } else {
      // Find participant by their token
      // Note: In mock data, participants have tokens stored internally
      const participant = event.participants.find(
        (p) => (p as { participantToken?: string }).participantToken === participantToken
      );
      if (!participant) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Invalid participant token',
            },
          },
          { status: 403 }
        );
      }
      participantId = participant.id;
    }

    // Check if user event already exists
    const userEventsData = (await authPersistence.getUserEvents()) as UserEventsData;
    const existingUserEvent = Object.values(userEventsData.userEvents).find(
      (ue: UserEvent) => ue.userId === userId && ue.eventId === eventId
    );

    if (existingUserEvent) {
      return NextResponse.json({ success: true, userEvent: existingUserEvent });
    }

    // Create UserEvent record
    const userEventId = authPersistence.generateId('ue');
    const now = new Date().toISOString();

    const userEvent = {
      id: userEventId,
      userId,
      eventId,
      participantId,
      role,
      createdAt: now,
    };

    userEventsData.userEvents[userEventId] = userEvent;
    await authPersistence.saveUserEvents(userEventsData);

    return NextResponse.json({ success: true, userEvent }, { status: 201 });
  } catch (error) {
    console.error('[API] Error claiming event:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to claim event',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Main handler - routes to mock or real backend based on configuration
 */
export async function handleClaimEvent(request: NextRequest): Promise<NextResponse> {
  return routeAuthUserRequest(request, 'users', '/me/events/claim', handleClaimEventMock);
}
