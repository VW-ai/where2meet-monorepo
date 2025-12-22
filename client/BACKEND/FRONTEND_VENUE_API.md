# Frontend Venue API Integration Guide

This guide explains how to integrate the venue search endpoints into your frontend application.

---

## Endpoints Overview

| Method | Endpoint             | Auth | Description                     |
| ------ | -------------------- | ---- | ------------------------------- |
| POST   | `/api/venues/search` | None | Search venues near event center |
| GET    | `/api/venues/:id`    | None | Get venue details               |

---

## 1. Search Venues

Search for venues near the calculated center of all participants.

### Request

```typescript
POST /api/venues/search
Content-Type: application/json

{
  "eventId": "evt_1702000000000_abc123",
  "searchRadius": 5000,           // meters (100-50000)
  "query": "coffee",              // text search (optional)
  "categories": ["cafe", "restaurant"]  // category filter (optional)
}
```

**Note:** At least one of `query` or `categories` must be provided.

### Available Categories

```typescript
type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'park'
  | 'museum'
  | 'shopping'
  | 'entertainment';
```

### Response

```typescript
{
  "venues": [
    {
      "id": "ChIJ...",           // Google Place ID (use for details/voting)
      "name": "Blue Bottle Coffee",
      "address": "450 W 15th St, New York, NY 10011",
      "location": {
        "lat": 40.7420,
        "lng": -74.0048
      },
      "types": ["cafe", "food", "establishment"],
      "rating": 4.5,             // null if no ratings
      "userRatingsTotal": 1234,  // null if no ratings
      "priceLevel": 2,           // 0-4, null if unknown
      "openNow": true,           // null if unknown
      "photoUrl": "https://maps.googleapis.com/..."  // null if no photo
    }
  ],
  "totalResults": 15,
  "searchCenter": {
    "lat": 40.7306,
    "lng": -73.9952
  }
}
```

### Error Responses

| Status | Code                     | Description                                           |
| ------ | ------------------------ | ----------------------------------------------------- |
| 400    | `VALIDATION_ERROR`       | Invalid input (missing eventId, invalid radius, etc.) |
| 404    | `EVENT_NOT_FOUND`        | Event does not exist                                  |
| 400    | `VALIDATION_ERROR`       | Event has no participants                             |
| 502    | `EXTERNAL_SERVICE_ERROR` | Google Places API failure                             |

---

## 2. Get Venue Details

Fetch detailed information about a specific venue.

### Request

```
GET /api/venues/ChIJ...
```

### Response

```typescript
{
  "id": "ChIJ...",
  "name": "Blue Bottle Coffee",
  "address": "450 W 15th St, New York, NY 10011",
  "location": {
    "lat": 40.7420,
    "lng": -74.0048
  },
  "types": ["cafe", "food", "establishment"],
  "rating": 4.5,
  "userRatingsTotal": 1234,
  "priceLevel": 2,
  "openNow": true,
  "photoUrl": "https://maps.googleapis.com/...",
  "formattedPhoneNumber": "(212) 555-1234",  // null if unavailable
  "website": "https://bluebottlecoffee.com", // null if unavailable
  "openingHours": [                          // null if unavailable
    "Monday: 7:00 AM – 7:00 PM",
    "Tuesday: 7:00 AM – 7:00 PM",
    ...
  ]
}
```

---

## Frontend Integration Example

### React/TypeScript Example

```typescript
// types/venue.ts
interface Venue {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  types: string[];
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  photoUrl: string | null;
}

interface VenueSearchResponse {
  venues: Venue[];
  totalResults: number;
  searchCenter: { lat: number; lng: number };
}

// api/venues.ts
const API_BASE = import.meta.env.VITE_API_URL;

export async function searchVenues(
  eventId: string,
  options: {
    searchRadius?: number;
    query?: string;
    categories?: string[];
  }
): Promise<VenueSearchResponse> {
  const response = await fetch(`${API_BASE}/api/venues/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      searchRadius: options.searchRadius ?? 5000,
      ...(options.query && { query: options.query }),
      ...(options.categories && { categories: options.categories }),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? 'Search failed');
  }

  return response.json();
}

export async function getVenueDetails(placeId: string) {
  const response = await fetch(`${API_BASE}/api/venues/${placeId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? 'Failed to fetch venue');
  }

  return response.json();
}
```

### Component Usage

```tsx
// VenueSearch.tsx
import { useState } from 'react';
import { searchVenues } from '../api/venues';

function VenueSearch({ eventId }: { eventId: string }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setLoading(true);
    try {
      const result = await searchVenues(eventId, {
        query,
        searchRadius: 5000,
      });
      setVenues(result.venues);
      setSearchCenter(result.searchCenter);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySearch = async (categories: string[]) => {
    setLoading(true);
    try {
      const result = await searchVenues(eventId, {
        categories,
        searchRadius: 3000,
      });
      setVenues(result.venues);
      setSearchCenter(result.searchCenter);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Search input */}
      <input
        type="text"
        placeholder="Search for venues..."
        onKeyDown={(e) => e.key === 'Enter' && handleSearch(e.currentTarget.value)}
      />

      {/* Category buttons */}
      <div>
        <button onClick={() => handleCategorySearch(['cafe'])}>Cafes</button>
        <button onClick={() => handleCategorySearch(['restaurant'])}>Restaurants</button>
        <button onClick={() => handleCategorySearch(['bar'])}>Bars</button>
      </div>

      {/* Display search center on map */}
      {searchCenter && (
        <p>
          Searching around: {searchCenter.lat}, {searchCenter.lng}
        </p>
      )}

      {/* Venue list */}
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} />
      ))}
    </div>
  );
}
```

---

## Map Integration

The `searchCenter` returned in the response is the MEC (Minimum Enclosing Circle) center of all participants. Use this to:

1. **Center the map** on this location when displaying search results
2. **Draw a circle** with the search radius to show the search area
3. **Plot venue markers** using each venue's `location`

```tsx
// With Google Maps
const map = new google.maps.Map(element, {
  center: searchCenter,
  zoom: 14,
});

// Draw search area circle
new google.maps.Circle({
  map,
  center: searchCenter,
  radius: 5000, // same as searchRadius
  fillColor: '#4285F4',
  fillOpacity: 0.1,
  strokeColor: '#4285F4',
  strokeWeight: 1,
});

// Add venue markers
venues.forEach((venue) => {
  new google.maps.Marker({
    map,
    position: venue.location,
    title: venue.name,
  });
});
```

---

## Caching Behavior

The backend caches Places API responses in Redis:

| Data Type      | Cache TTL | Notes                                        |
| -------------- | --------- | -------------------------------------------- |
| Search results | 1 hour    | Same query + location returns cached results |
| Venue details  | 24 hours  | Individual place details are cached longer   |

This means:

- Repeated searches are fast and don't hit Google's API
- Venue details modal loads quickly after initial fetch
- Cache is per-environment (dev/prod have separate caches)

---

## Best Practices

1. **Default search radius**: Use 5000m (5km) as a sensible default
2. **Combine query + categories**: For best results, use either query OR categories, not both
3. **Handle null values**: Rating, priceLevel, openNow, and photoUrl can all be null
4. **Use venue.id for voting**: The `id` field (Google Place ID) should be stored when users vote
5. **Show search center**: Display where the MEC center is so users understand the search area
