/**
 * Event Detail API Routes
 * GET /api/events/[id] - Get event by ID
 * PATCH /api/events/[id] - Update event
 * DELETE /api/events/[id] - Delete event
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const event = mockStore.getEvent(params.id);

  if (!event) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json(event);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const body = await request.json();
    const event = mockStore.updateEvent(params.id, body);

    if (!event) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Event not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('[API] Error updating event:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update event',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const success = mockStore.deleteEvent(params.id);

  if (!success) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Event deleted successfully',
  });
}
