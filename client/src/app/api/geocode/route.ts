/**
 * Geocode API Route
 * POST /api/geocode - Convert address to coordinates using Google Geocoding API
 */

import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/google-maps/geocoding';

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

    // Use Google Geocoding API
    const result = await geocodeAddress(body.address);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error geocoding address:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to geocode address',
        },
      },
      { status: 500 }
    );
  }
}
