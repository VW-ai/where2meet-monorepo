/**
 * Geocode API Route
 * POST /api/geocode - Convert address to coordinates
 */

import { NextRequest, NextResponse } from 'next/server';
import { GeocodeResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.address) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Address is required',
          },
        },
        { status: 400 }
      );
    }

    // Mock geocoding - return random location in NYC area
    const result: GeocodeResult = {
      address: body.address,
      location: {
        lat: 40.7128 + Math.random() * 0.1 - 0.05,
        lng: -74.006 + Math.random() * 0.1 - 0.05,
      },
      placeId: `mock_place_${Date.now()}`,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error geocoding address:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to geocode address',
        },
      },
      { status: 500 }
    );
  }
}
