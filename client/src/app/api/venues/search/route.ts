/**
 * Venue Search API Route
 * POST /api/venues/search - Search for venues using mock data
 *
 * Note: Using mock data instead of Google Places API server-side calls
 * to avoid API quota usage during development. In production, this would
 * use Google Places API REST endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MOCK_VENUES } from '@/mock-server/data/venues';
import { VenueSearchRequest, Venue } from '@/types';

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

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

    // Filter venues by distance and category
    let filteredVenues: Venue[] = MOCK_VENUES.filter((venue) => {
      // Calculate distance from center
      const distance = calculateDistance(
        body.center.lat,
        body.center.lng,
        venue.location.lat,
        venue.location.lng
      );

      // Check if within radius
      if (distance > body.radius) {
        return false;
      }

      // Check category filter
      if (body.categories && body.categories.length > 0) {
        return body.categories.includes(venue.category);
      }

      return true;
    });

    // Sort by distance (closest first)
    filteredVenues = filteredVenues.sort((a, b) => {
      const distA = calculateDistance(
        body.center.lat,
        body.center.lng,
        a.location.lat,
        a.location.lng
      );
      const distB = calculateDistance(
        body.center.lat,
        body.center.lng,
        b.location.lat,
        b.location.lng
      );
      return distA - distB;
    });

    return NextResponse.json({
      venues: filteredVenues,
      totalResults: filteredVenues.length,
    });
  } catch (error) {
    console.error('[API] Error searching venues:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search venues',
        },
      },
      { status: 500 }
    );
  }
}
