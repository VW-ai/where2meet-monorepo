/**
 * Claim Token API Route
 * POST /api/auth/claim-token - Link an event to user account via token
 */

import { NextRequest, NextResponse } from 'next/server';
import { authPersistence } from '@/mock-server/auth-persistence';
import { loadData } from '@/mock-server/services/persistence';
import { SessionsData, Session, UserEventsData, UserEvent } from '@/types/user';

export async function POST(request: NextRequest) {
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
    const { eventId, token, tokenType } = body;

    if (!eventId || !token || !tokenType) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'eventId, token, and tokenType are required',
          },
        },
        { status: 400 }
      );
    }

    if (tokenType !== 'organizer' && tokenType !== 'participant') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tokenType must be "organizer" or "participant"',
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

    // Note: In a real backend, we would verify the token matches the stored token
    // For this mock implementation, we trust the frontend and just create the UserEvent record

    // Check if user event already exists
    const userEventsData = (await authPersistence.getUserEvents()) as UserEventsData;
    const existingUserEvent = Object.values(userEventsData.userEvents).find(
      (ue: UserEvent) => ue.userId === userId && ue.eventId === eventId && ue.role === tokenType
    );

    if (existingUserEvent) {
      return NextResponse.json({ success: true, userEvent: existingUserEvent });
    }

    // Find participant ID from event
    const participantId =
      tokenType === 'organizer'
        ? event.participants.find((p) => p.isOrganizer)?.id
        : event.participants.find((p) => !p.isOrganizer && p.id)?.id;

    // Create UserEvent record
    const userEventId = authPersistence.generateId('ue');
    const now = new Date().toISOString();

    const userEvent = {
      id: userEventId,
      userId,
      eventId,
      participantId: participantId || null,
      role: tokenType,
      createdAt: now,
    };

    userEventsData.userEvents[userEventId] = userEvent;
    await authPersistence.saveUserEvents(userEventsData);

    return NextResponse.json({ success: true, userEvent });
  } catch (error) {
    console.error('[API] Error claiming token:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to claim token',
        },
      },
      { status: 500 }
    );
  }
}
