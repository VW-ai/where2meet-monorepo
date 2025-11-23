/**
 * Venue Search API Route
 * POST /api/venues/search - Search for venues
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockStore } from '@/mock-server/store';
import { VenueSearchRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: VenueSearchRequest = await request.json();

    // Validate required fields
    if (!body.center || !body.radius) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Center location and radius are required',
          },
        },
        { status: 400 }
      );
    }

    // Search venues
    const venues = mockStore.searchVenues(body.center, body.radius, body.categories);

    return NextResponse.json({
      venues,
      totalResults: venues.length,
    });
  } catch (error) {
    console.error('[API] Error searching venues:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search venues',
        },
      },
      { status: 500 }
    );
  }
}
