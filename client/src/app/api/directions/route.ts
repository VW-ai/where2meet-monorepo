/**
 * Directions API Route
 * POST /api/directions - Calculate routes from origins to destination
 */

import { NextRequest, NextResponse } from 'next/server';
import { DirectionsRequest, DirectionsResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: DirectionsRequest = await request.json();

    if (!body.origins || !body.destination) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Origins and destination are required',
          },
        },
        { status: 400 }
      );
    }

    // Mock directions - generate random travel times
    const routes = body.origins.map((_, index) => ({
      participantId: `prt_mock_${index}`,
      distance: {
        text: `${(Math.random() * 10 + 1).toFixed(1)} km`,
        value: Math.floor(Math.random() * 10000 + 1000),
      },
      duration: {
        text: `${Math.floor(Math.random() * 30 + 5)} mins`,
        value: Math.floor(Math.random() * 1800 + 300),
      },
      polyline: 'mock_polyline_data',
    }));

    const response: DirectionsResponse = { routes };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error calculating directions:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to calculate directions',
        },
      },
      { status: 500 }
    );
  }
}
