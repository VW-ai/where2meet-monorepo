/**
 * Participants API Routes
 * POST /api/events/[id]/participants - Add participant to event
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';
import { CreateParticipantDTO } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const body: CreateParticipantDTO = await request.json();

    // Validate required fields
    if (!body.name || !body.address) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name and address are required',
          },
        },
        { status: 400 }
      );
    }

    // Add participant
    const participant = await mockStore.addParticipant(params.id, {
      name: body.name,
      address: body.address,
      fuzzyLocation: body.fuzzyLocation || false,
    });

    if (!participant) {
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

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error('[API] Error adding participant:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add participant',
        },
      },
      { status: 500 }
    );
  }
}
