/**
 * Events API Routes
 * POST /api/events - Create new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';
import { CreateEventDTO } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateEventDTO = await request.json();

    // Validate required fields
    if (!body.title || !body.meetingTime) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Title and meeting time are required',
          },
        },
        { status: 400 }
      );
    }

    // Create event
    const event = mockStore.createEvent({
      ...body,
      organizerId: `org_${Date.now()}`,
      organizerToken: `mock_token_${Date.now()}`,
      settings: { organizerOnly: false },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating event:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create event',
        },
      },
      { status: 500 }
    );
  }
}
