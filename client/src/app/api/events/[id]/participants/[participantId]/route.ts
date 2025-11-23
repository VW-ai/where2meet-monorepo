/**
 * Participant Detail API Routes
 * PATCH /api/events/[id]/participants/[participantId] - Update participant
 * DELETE /api/events/[id]/participants/[participantId] - Remove participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';

interface RouteContext {
  params: Promise<{ id: string; participantId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const body = await request.json();
    const participant = await mockStore.updateParticipant(params.id, params.participantId, body);

    if (!participant) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Participant not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(participant);
  } catch (error) {
    console.error('[API] Error updating participant:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update participant',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const success = mockStore.removeParticipant(params.id, params.participantId);

  if (!success) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Participant not found',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Participant removed successfully',
  });
}
