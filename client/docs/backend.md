# Backend Developer Reference

> Where2Meet v1.0 Client - API & Data Architecture

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Mock Data Locations](#mock-data-locations)
3. [API Routes](#api-routes)
4. [Type Definitions](#type-definitions)
5. [External APIs (Google Maps)](#external-apis-google-maps)
6. [Store Structures](#store-structures)
7. [What Needs Real Backend](#what-needs-real-backend)

---

## Quick Start

### Current Architecture

- **Frontend:** Next.js 14 (App Router)
- **State Management:** Zustand
- **Mock Backend:** File-based persistence in `.mock-data/events.json`
- **External APIs:** Google Maps (Geocoding, Places, Directions)

### Key Directories

```
src/
├── app/api/           # API route handlers (mock implementation)
├── lib/
│   ├── api/mock/      # Mock autocomplete data
│   └── google-maps/   # Google Maps API wrappers
├── mock-server/       # Mock data store & persistence
├── store/             # Zustand stores (frontend state)
└── types/             # TypeScript type definitions
```

---

## Mock Data Locations

### 1. Mock Venues (9 NYC venues)

**File:** `src/mock-server/data/venues.ts`

Used for venue search results when Google Places API is not available.

```typescript
// Example venue structure
{
  id: 'central-park-cafe',
  name: 'Central Park Cafe',
  address: '14 E 60th St, New York, NY 10022',
  location: { lat: 40.7649, lng: -73.9725 },
  category: 'cafe',
  rating: 4.5,
  priceLevel: 2,
  openNow: true
}
```

### 2. Mock Address Autocomplete (52 NYC addresses)

**File:** `src/lib/api/mock/places-autocomplete.ts`

Exported as `NYC_ADDRESSES` - used for participant address input.

```typescript
{
  place_id: 'mock_empire_state',
  main_text: '350 5th Ave',
  secondary_text: 'New York, NY',
  full_address: '350 5th Ave, New York, NY 10118'
}
```

### 3. Mock Venue Autocomplete (90+ NYC venues)

**File:** `src/lib/api/mock/venue-autocomplete.ts`

Categories: Gyms (25), Bars (30), Cafes (25), Things To Do (20)

### 4. Mock Geocoding

**File:** `src/lib/api/mock/geocoding.ts`

Falls back to random NYC coordinates when Google API key is missing.

### 5. Mock Data Store (Persistence)

**File:** `src/mock-server/store.ts`

In-memory store with file persistence to `.mock-data/events.json`

---

## API Routes

### Events

#### Create Event

```
POST /api/events
```

**Request:**

```json
{
  "title": "Team Lunch",
  "meetingTime": "2024-01-15T12:00:00Z"
}
```

**Response (201):**

```json
{
  "id": "evt_1234567890_abc",
  "title": "Team Lunch",
  "meetingTime": "2024-01-15T12:00:00Z",
  "organizerId": "org_xxx",
  "organizerToken": "token_xxx",
  "createdAt": "2024-01-10T10:00:00Z",
  "participants": [],
  "publishedVenueId": null,
  "settings": { "organizerOnly": false }
}
```

#### Get Event

```
GET /api/events/[id]
```

**Response (200):** Full Event object
**Error (404):** `{ "error": "Event not found" }`

#### Update Event

```
PATCH /api/events/[id]
```

**Request:**

```json
{
  "title": "Updated Title",
  "meetingTime": "2024-01-16T12:00:00Z",
  "settings": { "organizerOnly": true }
}
```

#### Delete Event

```
DELETE /api/events/[id]
```

**Response (200):** `{ "success": true, "message": "Event deleted successfully" }`

---

### Participants

#### Add Participant

```
POST /api/events/[id]/participants
```

**Request:**

```json
{
  "name": "Alice",
  "address": "350 5th Ave, New York, NY",
  "fuzzyLocation": false
}
```

**Response (201):**

```json
{
  "id": "p_1234567890_xyz",
  "name": "Alice",
  "address": "350 5th Ave, New York, NY",
  "location": { "lat": 40.7484, "lng": -73.9857 },
  "color": "bg-coral-500",
  "fuzzyLocation": false,
  "createdAt": "2024-01-10T10:00:00Z"
}
```

**Backend Flow:**

1. Geocode address -> coordinates (Google API or mock)
2. If `fuzzyLocation: true`, add ~5km random offset
3. Assign random color from 10-color palette
4. Generate unique ID
5. Persist to storage

#### Update Participant

```
PATCH /api/events/[id]/participants/[participantId]
```

**Request:**

```json
{
  "name": "Alice Smith",
  "address": "New Address, NY"
}
```

_Note: If address changes, re-geocodes automatically_

#### Remove Participant

```
DELETE /api/events/[id]/participants/[participantId]
```

---

### Venues

#### Search Venues

```
POST /api/venues/search
```

**Request:**

```json
{
  "center": { "lat": 40.7489, "lng": -73.968 },
  "radius": 5000,
  "categories": ["cafe", "restaurant"]
}
```

**Response (200):**

```json
{
  "venues": [
    /* Venue[] */
  ],
  "totalResults": 5
}
```

**Current Implementation:** Filters mock venues by Haversine distance.
**Production:** Should call Google Places API.

#### Get Venue Details

```
GET /api/venues/[id]
```

---

### Geocoding

#### Geocode Address

```
POST /api/geocode
```

**Request:**

```json
{
  "address": "350 5th Ave, New York, NY"
}
```

**Response (200):**

```json
{
  "address": "350 5th Ave, New York, NY 10118",
  "location": { "lat": 40.7484, "lng": -73.9857 },
  "placeId": "ChIJtcaxrqlZwokR..."
}
```

---

### Directions

#### Calculate Routes

```
POST /api/directions
```

**Request:**

```json
{
  "origins": [
    { "lat": 40.7484, "lng": -73.9857 },
    { "lat": 40.758, "lng": -73.9855 }
  ],
  "destination": { "lat": 40.7614, "lng": -73.9776 },
  "travelMode": "driving"
}
```

**Response (200):**

```json
{
  "routes": [
    {
      "participantId": "0",
      "distance": { "text": "2.5 km", "value": 2500 },
      "duration": { "text": "8 mins", "value": 480 },
      "polyline": "encoded_polyline_string"
    }
  ]
}
```

**Current:** Returns random mock data.
**Production:** Should call Google Directions API.

---

## Type Definitions

### Location: `src/types/index.ts`

```typescript
interface Location {
  lat: number;
  lng: number;
}
```

### Event: `src/types/event.ts`

```typescript
interface Event {
  id: string;
  title: string;
  meetingTime: string; // ISO 8601
  organizerId: string;
  organizerToken?: string;
  createdAt: string;
  updatedAt?: string;
  participants: Participant[];
  publishedVenueId?: string | null;
  publishedAt?: string | null;
  settings: {
    organizerOnly: boolean;
  };
}
```

### Participant: `src/types/participant.ts`

```typescript
interface Participant {
  id: string;
  name: string;
  address: string;
  location: Location;
  color: string; // Tailwind class: 'bg-coral-500'
  fuzzyLocation: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}
```

**Available Colors:**

- `bg-coral-500`, `bg-mint-500`, `bg-sunshine-500`, `bg-lavender-500`
- `bg-red-500`, `bg-blue-500`, `bg-green-500`, `bg-purple-500`
- `bg-pink-500`, `bg-orange-500`

### Venue: `src/types/venue.ts`

```typescript
interface Venue {
  id: string;
  name: string;
  address: string;
  location: Location;
  category: VenueCategory;
  rating?: number;
  priceLevel?: number; // 1-4 scale
  photoUrl?: string;
  photos?: string[];
  openNow?: boolean;
  openingHours?: string[];
  phoneNumber?: string;
  website?: string;
  description?: string;
  voteCount?: number;
}

type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'gym'
  | 'park'
  | 'museum'
  | 'library'
  | 'things_to_do'
  | 'other';
```

### Travel Mode: `src/types/index.ts`

```typescript
type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';
```

### API Types: `src/types/api.ts`

```typescript
interface VenueSearchRequest {
  center: Location;
  radius: number; // meters
  categories?: VenueCategory[];
}

interface DirectionsRequest {
  origins: Location[];
  destination: Location;
  travelMode: TravelMode;
}

interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## External APIs (Google Maps)

### Required Environment Variable

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

### API Wrappers Location

All Google Maps integrations: `src/lib/google-maps/`

| File                     | Purpose                    |
| ------------------------ | -------------------------- |
| `loader.ts`              | Loads Google Maps JS SDK   |
| `geocoding.ts`           | Address <-> Coordinates    |
| `places-autocomplete.ts` | Address search suggestions |
| `places-nearby.ts`       | Venue search & details     |
| `directions.ts`          | Route calculation          |

### APIs Used

| API                  | Current Usage                    | Location                                     |
| -------------------- | -------------------------------- | -------------------------------------------- |
| Geocoding            | Server-side (with mock fallback) | `src/mock-server/services/geocoding.ts`      |
| Places Autocomplete  | Client-side                      | `src/lib/google-maps/places-autocomplete.ts` |
| Places Nearby Search | Client-side                      | `src/lib/google-maps/places-nearby.ts`       |
| Place Details        | Client-side                      | `src/lib/google-maps/places-nearby.ts`       |
| Directions           | **MOCKED**                       | `src/app/api/directions/route.ts`            |

### Category Mapping (Places API)

```typescript
const CATEGORY_TO_GOOGLE_TYPE = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  bar: 'bar',
  gym: 'gym',
  park: 'park',
  museum: 'museum',
  library: 'library',
  things_to_do: 'tourist_attraction',
  other: 'point_of_interest',
};
```

---

## Store Structures

Frontend uses Zustand for state management. Relevant for understanding data flow.

### Meeting Store: `src/store/useMeetingStore.ts`

```typescript
interface MeetingState {
  // Event
  currentEvent: Event | null;
  isLoadingEvent: boolean;
  eventError: string | null;

  // Venues
  searchedVenues: Venue[];
  savedVenues: string[]; // IDs
  likedVenueData: Record<string, Venue>; // Full data for liked venues
  userVotes: Record<string, boolean>;

  // Map
  searchRadius: number; // default: 5000m
  travelMode: TravelMode; // default: 'driving'
  mapCenter: Location | null;
}
```

### UI Store: `src/store/ui-store.ts`

```typescript
interface UIStore {
  isOrganizerMode: boolean;
  activeView: 'participant' | 'venue';
  selectedCategory: CategoryFilter;
  selectedTravelMode: 'car' | 'transit' | 'walk' | 'bike';
  searchQuery: string;
  executedSearchQuery: string;
  // ... modal states
}
```

### Map Store: `src/store/map-store.ts`

```typescript
interface MapStore {
  mecCircle: { center: Location; radius: number } | null;
  searchRadius: number;
  routes: RouteInfo[];
  selectedParticipantId: string | null;
  hoveredVenueId: string | null;
  isCalculatingRoutes: boolean;
}

interface RouteInfo {
  participantId: string;
  distance: string; // "2.5 km"
  duration: string; // "8 mins"
  polyline: string;
}
```

---

## What Needs Real Backend

### Currently Mocked (Replace with Database)

| Feature      | Mock Location                | Production Need                 |
| ------------ | ---------------------------- | ------------------------------- |
| Event CRUD   | `src/mock-server/store.ts`   | Database table                  |
| Participants | Part of Event in store       | Database table with FK          |
| Venue Search | `src/app/api/venues/search/` | Google Places API (server-side) |
| Directions   | `src/app/api/directions/`    | Google Directions API           |
| Venue Voting | In-memory only               | Database persistence            |
| Saved Venues | In-memory only               | User preferences table          |

### Production Backend Requirements

#### 1. Database Schema

```sql
-- Events table
CREATE TABLE events (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  meeting_time TIMESTAMP NOT NULL,
  organizer_id VARCHAR NOT NULL,
  organizer_token VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  published_venue_id VARCHAR,
  published_at TIMESTAMP,
  settings JSONB DEFAULT '{"organizerOnly": false}'
);

-- Participants table
CREATE TABLE participants (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  address VARCHAR NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  color VARCHAR NOT NULL,
  fuzzy_location BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Venue votes table
CREATE TABLE venue_votes (
  id SERIAL PRIMARY KEY,
  venue_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  event_id VARCHAR REFERENCES events(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(venue_id, user_id, event_id)
);
```

#### 2. API Security

- Move Google API calls to backend (hide API key)
- Implement proper authentication (JWT/sessions)
- Add rate limiting
- Validate organizer tokens

#### 3. Missing Endpoints Needed

```
GET  /api/events/[id]/votes          # Get all votes for event venues
POST /api/events/[id]/venues/[venueId]/vote   # Vote for venue
DELETE /api/events/[id]/venues/[venueId]/vote # Remove vote
POST /api/events/[id]/publish        # Publish final venue
```

#### 4. Caching Strategy

- Cache geocoding results (addresses rarely change)
- Cache venue search results (5-15 min TTL)
- Cache directions (same origin/destination)

---

## Data Flow Example

### Adding a Participant (Current Flow)

```
1. Frontend: POST /api/events/[id]/participants
   Body: { name, address, fuzzyLocation }

2. API Route: src/app/api/events/[id]/participants/route.ts
   - Validates event exists
   - Calls geocodeAddress(address)

3. Geocoding: src/mock-server/services/geocoding.ts
   - If GOOGLE_API_KEY: calls Google Geocoding API
   - Else: returns mock NYC coordinates

4. Store: src/mock-server/store.ts
   - Generates participant ID
   - Assigns random color
   - Applies fuzzy offset if enabled
   - Persists to .mock-data/events.json

5. Response: Created participant object

6. Frontend: useMeetingStore.addParticipant(participant)
```

### Searching Venues (Current Flow)

```
1. User: Enters search query + selects category

2. Frontend: Calls searchPlacesByText() from places-nearby.ts
   - Uses Google Places Text Search API (client-side)

3. Google Places API: Returns place results

4. Frontend: Maps results to Venue type
   - Stores in useMeetingStore.setSearchedVenues()

5. Map: Renders venue markers
```

---

## Quick Reference

### File Locations Summary

| What             | Where                                        |
| ---------------- | -------------------------------------------- |
| API Routes       | `src/app/api/`                               |
| Type Definitions | `src/types/`                                 |
| Mock Data        | `src/mock-server/data/`, `src/lib/api/mock/` |
| Mock Store       | `src/mock-server/store.ts`                   |
| Persistence      | `src/mock-server/services/persistence.ts`    |
| Google Maps      | `src/lib/google-maps/`                       |
| Frontend State   | `src/store/`                                 |

### Environment Variables

```bash
# Required for Google Maps features
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key

# Mock data persistence (auto-created)
# .mock-data/events.json
```

---

## Questions?

Key files to understand the full picture:

1. `src/types/index.ts` - All type exports
2. `src/mock-server/store.ts` - Data model behavior
3. `src/app/api/events/[id]/route.ts` - Event CRUD pattern
4. `src/lib/google-maps/places-nearby.ts` - Venue search implementation
