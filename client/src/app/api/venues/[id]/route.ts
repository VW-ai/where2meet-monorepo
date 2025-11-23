/**
 * Venue Detail API Route
 * GET /api/venues/[id] - Get venue by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const venue = mockStore.getVenue(params.id);

  if (!venue) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Venue not found',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json(venue);
}
