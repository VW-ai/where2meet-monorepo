# Milestone 1: Foundation & Landing Page - Implementation Plan

> **Duration**: Week 1 (5 days)
> **Status**: ✅ COMPLETE
> **Prerequisites**: Milestone 0 Complete ✅
> **Completed**: 2025-11-23

---

## Progress Summary

### ✅ Completed (Day 1-4)
- Type system defined (`src/types/`)
- Mock server with Next.js API routes (`src/app/api/`)
- File-based persistence (`src/mock-server/`)
- Google Maps Geocoding integration
- Zustand store structure (`src/store/useMeetingStore.ts`)
- UI components: Button, Input, Calendar, AppointmentPicker, ScrollArea, Popover (`src/components/ui/`)
- Landing page with event creation flow
- Enhanced calendar component with originui styling and coral theming
- Type-safe API client (all `any` types removed)
- Code cleanup (removed unused components: DatePicker, ShareModal)
- Linting cleanup (fixed all warnings except server-side console.logs)

---

## Overview

This milestone establishes the foundation for the entire application:
- **Type system** for type safety across the app ✅
- **Mock API server** with file persistence for development ✅
- **Zustand store** for state management ✅
- **Landing page** with event creation flow 🔄

---

## Day 1-2: Type System & Data Layer ✅ COMPLETE

### Goal
Build the data foundation: TypeScript interfaces, mock data store, and API client that switches between mock/real backends.

---

### Task 1.1: Define TypeScript Interfaces (2 hours)

**File**: `src/types/index.ts`

**Implementation Steps**:

1. **Create core type definitions**:
```typescript
// Event types
export interface Event {
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
  settings: EventSettings;
}

export interface EventSettings {
  organizerOnly: boolean;
}

// Participant types
export interface Participant {
  id: string;
  name: string;
  address: string;
  location: Location;
  color: string;
  fuzzyLocation: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

// Location types
export interface Location {
  lat: number;
  lng: number;
}

// Venue types
export interface Venue {
  id: string;
  name: string;
  address: string;
  location: Location;
  category: VenueCategory;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  photos?: string[];
  openNow?: boolean;
  openingHours?: string[];
  phoneNumber?: string;
  website?: string;
  description?: string;
  voteCount?: number;
}

export type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'gym'
  | 'park'
  | 'museum'
  | 'library'
  | 'other';

// Travel types
export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

export interface Route {
  participantId: string;
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  polyline?: string;
}

// API Response types
export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface VenueSearchResponse {
  venues: Venue[];
  totalResults: number;
}

export interface DirectionsResponse {
  routes: Route[];
}
```

2. **Add utility types**:
```typescript
export type CreateEventDTO = Pick<Event, 'title' | 'meetingTime'>;
export type CreateParticipantDTO = Pick<Participant, 'name' | 'address'> & {
  fuzzyLocation?: boolean;
};
export type UpdateEventDTO = Partial<Pick<Event, 'title' | 'meetingTime'>> & {
  settings?: Partial<EventSettings>;
};
```

**Tests**: Create `src/types/index.test.ts` (Type validation tests if using runtime validation)

**Verification**:
```bash
npm run type-check
```

---

### Task 1.2: Create Mock Data Store (3 hours)

**File**: `src/lib/mock/store.ts`

**Implementation Steps**:

1. **Set up in-memory data store class**:
```typescript
import { Event, Participant, Venue, Location } from '@/types';

class MockDataStore {
  private events: Map<string, Event> = new Map();
  private venues: Map<string, Venue> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Add sample venues for development
    const sampleVenues: Venue[] = [
      {
        id: 'ven_001',
        name: 'Central Park Cafe',
        address: '789 Park Ave, New York, NY 10021',
        location: { lat: 40.7829, lng: -73.9654 },
        category: 'cafe',
        rating: 4.5,
        priceLevel: 2,
        photoUrl: '/images/placeholder-cafe.jpg',
        openNow: true,
        openingHours: ['Mon-Fri: 7AM-8PM', 'Sat-Sun: 8AM-7PM'],
        voteCount: 0,
      },
      {
        id: 'ven_002',
        name: 'Brooklyn Coffee House',
        address: '456 Bedford Ave, Brooklyn, NY 11249',
        location: { lat: 40.7217, lng: -73.9568 },
        category: 'cafe',
        rating: 4.7,
        priceLevel: 2,
        photoUrl: '/images/placeholder-cafe.jpg',
        openNow: true,
        openingHours: ['Mon-Sun: 6AM-10PM'],
        voteCount: 0,
      },
      // Add 5-10 more sample venues for each category
    ];

    sampleVenues.forEach(venue => this.venues.set(venue.id, venue));
  }

  // Event CRUD operations
  createEvent(data: Omit<Event, 'id' | 'createdAt' | 'participants'>): Event {
    const newEvent: Event = {
      ...data,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      participants: [],
    };
    this.events.set(newEvent.id, newEvent);
    return newEvent;
  }

  getEvent(id: string): Event | undefined {
    return this.events.get(id);
  }

  updateEvent(id: string, updates: Partial<Event>): Event | undefined {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = {
      ...event,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  deleteEvent(id: string): boolean {
    return this.events.delete(id);
  }

  // Participant operations
  addParticipant(
    eventId: string,
    data: Omit<Participant, 'id' | 'createdAt' | 'location' | 'color'>
  ): Participant | undefined {
    const event = this.events.get(eventId);
    if (!event) return undefined;

    const newParticipant: Participant = {
      ...data,
      id: `prt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location: this.mockGeocode(data.address),
      color: this.getRandomColor(),
      createdAt: new Date().toISOString(),
    };

    event.participants.push(newParticipant);
    this.events.set(eventId, event);
    return newParticipant;
  }

  updateParticipant(
    eventId: string,
    participantId: string,
    updates: Partial<Participant>
  ): Participant | undefined {
    const event = this.events.get(eventId);
    if (!event) return undefined;

    const participantIndex = event.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) return undefined;

    const updatedParticipant = {
      ...event.participants[participantIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    event.participants[participantIndex] = updatedParticipant;
    this.events.set(eventId, event);
    return updatedParticipant;
  }

  removeParticipant(eventId: string, participantId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const initialLength = event.participants.length;
    event.participants = event.participants.filter(p => p.id !== participantId);

    if (event.participants.length < initialLength) {
      this.events.set(eventId, event);
      return true;
    }
    return false;
  }

  // Venue operations
  searchVenues(
    center: Location,
    radius: number,
    categories?: string[]
  ): Venue[] {
    let results = Array.from(this.venues.values());

    // Filter by category
    if (categories && categories.length > 0) {
      results = results.filter(v => categories.includes(v.category));
    }

    // Simple distance filter (in production, use proper geo calculations)
    results = results.filter(venue => {
      const distance = this.calculateDistance(center, venue.location);
      return distance <= radius;
    });

    return results;
  }

  getVenue(id: string): Venue | undefined {
    return this.venues.get(id);
  }

  // Mock geocoding
  private mockGeocode(address: string): Location {
    // Simple mock: generate random location in NYC area
    // In real app, this would call Google Geocoding API
    return {
      lat: 40.7128 + (Math.random() - 0.5) * 0.2,
      lng: -74.0060 + (Math.random() - 0.5) * 0.2,
    };
  }

  // Utility methods
  private getRandomColor(): string {
    const colors = [
      'bg-coral-500',
      'bg-mint-500',
      'bg-sunshine-500',
      'bg-lavender-500',
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-orange-500',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private calculateDistance(loc1: Location, loc2: Location): number {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth radius in meters
    const φ1 = (loc1.lat * Math.PI) / 180;
    const φ2 = (loc2.lat * Math.PI) / 180;
    const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Reset for testing
  reset() {
    this.events.clear();
    this.venues.clear();
    this.seedInitialData();
  }
}

// Export singleton instance
export const mockStore = new MockDataStore();
```

**Tests**: Create `src/lib/mock/store.test.ts`
```typescript
import { mockStore } from './store';

describe('MockDataStore', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('Event operations', () => {
    it('should create a new event', () => {
      const event = mockStore.createEvent({
        title: 'Test Event',
        meetingTime: '2024-12-15T12:00:00Z',
        organizerId: 'org_test',
        settings: { organizerOnly: false },
      });

      expect(event.id).toMatch(/^evt_/);
      expect(event.title).toBe('Test Event');
      expect(event.participants).toEqual([]);
    });

    it('should retrieve an event by id', () => {
      const created = mockStore.createEvent({
        title: 'Test Event',
        meetingTime: '2024-12-15T12:00:00Z',
        organizerId: 'org_test',
        settings: { organizerOnly: false },
      });

      const retrieved = mockStore.getEvent(created.id);
      expect(retrieved).toEqual(created);
    });
  });

  // Add more tests for participants, venues, etc.
});
```

---

### Task 1.3: Create Mock API Client (2 hours)

**File**: `src/lib/api/mock-client.ts`

**Implementation Steps**:

1. **Implement mock API handler**:
```typescript
import { mockStore } from '../mock/store';
import {
  Event,
  Participant,
  Venue,
  VenueSearchResponse,
  CreateEventDTO,
  CreateParticipantDTO
} from '@/types';

// Simulate network delay
const delay = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

export async function mockApiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  await delay(); // Simulate network latency

  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;

  console.log(`[Mock API] ${method} ${endpoint}`, body);

  // POST /api/events - Create event
  if (endpoint === '/api/events' && method === 'POST') {
    const data = body as CreateEventDTO;
    const event = mockStore.createEvent({
      ...data,
      organizerId: `org_${Date.now()}`,
      organizerToken: `mock_token_${Date.now()}`,
      settings: { organizerOnly: false },
    });
    return event as T;
  }

  // GET /api/events/:id - Get event
  const getEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (getEventMatch && method === 'GET') {
    const event = mockStore.getEvent(getEventMatch[1]);
    if (!event) {
      throw new Error('Event not found');
    }
    return event as T;
  }

  // PATCH /api/events/:id - Update event
  const updateEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (updateEventMatch && method === 'PATCH') {
    const event = mockStore.updateEvent(updateEventMatch[1], body);
    if (!event) {
      throw new Error('Event not found');
    }
    return event as T;
  }

  // DELETE /api/events/:id - Delete event
  const deleteEventMatch = endpoint.match(/^\/api\/events\/([^\/]+)$/);
  if (deleteEventMatch && method === 'DELETE') {
    const success = mockStore.deleteEvent(deleteEventMatch[1]);
    if (!success) {
      throw new Error('Event not found');
    }
    return { success: true, message: 'Event deleted' } as T;
  }

  // POST /api/events/:eventId/participants - Add participant
  const addParticipantMatch = endpoint.match(/^\/api\/events\/([^\/]+)\/participants$/);
  if (addParticipantMatch && method === 'POST') {
    const data = body as CreateParticipantDTO;
    const participant = mockStore.addParticipant(addParticipantMatch[1], {
      name: data.name,
      address: data.address,
      fuzzyLocation: data.fuzzyLocation || false,
    });
    if (!participant) {
      throw new Error('Event not found');
    }
    return participant as T;
  }

  // POST /api/venues/search - Search venues
  if (endpoint === '/api/venues/search' && method === 'POST') {
    const { center, radius, categories } = body;
    const venues = mockStore.searchVenues(center, radius, categories);
    const response: VenueSearchResponse = {
      venues,
      totalResults: venues.length,
    };
    return response as T;
  }

  // GET /api/venues/:id - Get venue details
  const getVenueMatch = endpoint.match(/^\/api\/venues\/([^\/]+)$/);
  if (getVenueMatch && method === 'GET') {
    const venue = mockStore.getVenue(getVenueMatch[1]);
    if (!venue) {
      throw new Error('Venue not found');
    }
    return venue as T;
  }

  // POST /api/geocode - Geocode address (mock)
  if (endpoint === '/api/geocode' && method === 'POST') {
    const { address } = body;
    return {
      address,
      location: {
        lat: 40.7128 + Math.random() * 0.1,
        lng: -74.0060 + Math.random() * 0.1,
      },
      placeId: `mock_place_${Date.now()}`,
    } as T;
  }

  throw new Error(`[Mock API] Endpoint not implemented: ${method} ${endpoint}`);
}
```

**File**: `src/lib/api/client.ts`

2. **Create main API client that switches between mock/real**:
```typescript
import { mockApiCall } from './mock-client';

const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    // Use mock API in development
    if (USE_MOCK_API) {
      console.log('[API] Using mock API');
      return await mockApiCall<T>(endpoint, options);
    }

    // Real API call
    const url = `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new APIError(
        response.status,
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || 'An error occurred',
        errorData.error?.details
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(0, 'NETWORK_ERROR', 'Network request failed');
  }
}

// Convenience API methods
export const api = {
  events: {
    create: (data: { title: string; meetingTime: string }) =>
      apiCall<any>('/api/events', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    get: (id: string) =>
      apiCall<any>(`/api/events/${id}`),

    update: (id: string, data: any, token: string) =>
      apiCall<any>(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    delete: (id: string, token: string) =>
      apiCall<any>(`/api/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  participants: {
    add: (eventId: string, data: any) =>
      apiCall<any>(`/api/events/${eventId}/participants`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  venues: {
    search: (data: any) =>
      apiCall<any>('/api/venues/search', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    get: (id: string) =>
      apiCall<any>(`/api/venues/${id}`),
  },

  geocode: (address: string) =>
    apiCall<any>('/api/geocode', {
      method: 'POST',
      body: JSON.stringify({ address })
    }),
};
```

**Tests**: Create `src/lib/api/client.test.ts`

---

### Task 1.4: Set Up Zustand Store (2 hours)

**File**: `src/store/useMeetingStore.ts`

**Implementation Steps**:

1. **Create Zustand store with initial state and actions**:
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Event, Participant, Venue, TravelMode, Location } from '@/types';

interface MeetingState {
  // Event state
  currentEvent: Event | null;
  isLoadingEvent: boolean;
  eventError: string | null;

  // UI state
  activeSection: 'participants' | 'venues';
  selectedVenue: Venue | null;
  selectedParticipant: Participant | null;

  // Map state
  searchRadius: number; // in meters
  travelMode: TravelMode;
  mapCenter: Location | null;

  // Actions
  setCurrentEvent: (event: Event) => void;
  updateEvent: (updates: Partial<Event>) => void;
  setLoadingEvent: (loading: boolean) => void;
  setEventError: (error: string | null) => void;

  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;

  setActiveSection: (section: 'participants' | 'venues') => void;
  setSelectedVenue: (venue: Venue | null) => void;
  setSelectedParticipant: (participant: Participant | null) => void;

  setSearchRadius: (radius: number) => void;
  setTravelMode: (mode: TravelMode) => void;
  setMapCenter: (center: Location | null) => void;

  reset: () => void;
}

const initialState = {
  currentEvent: null,
  isLoadingEvent: false,
  eventError: null,
  activeSection: 'participants' as const,
  selectedVenue: null,
  selectedParticipant: null,
  searchRadius: 5000, // 5km default
  travelMode: 'driving' as TravelMode,
  mapCenter: null,
};

export const useMeetingStore = create<MeetingState>()(
  devtools(
    (set) => ({
      ...initialState,

      setCurrentEvent: (event) => set({ currentEvent: event }),

      updateEvent: (updates) =>
        set((state) => ({
          currentEvent: state.currentEvent
            ? { ...state.currentEvent, ...updates }
            : null,
        })),

      setLoadingEvent: (loading) => set({ isLoadingEvent: loading }),

      setEventError: (error) => set({ eventError: error }),

      addParticipant: (participant) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: [...state.currentEvent.participants, participant],
            },
          };
        }),

      updateParticipant: (id, updates) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: state.currentEvent.participants.map((p) =>
                p.id === id ? { ...p, ...updates } : p
              ),
            },
          };
        }),

      removeParticipant: (id) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: state.currentEvent.participants.filter(
                (p) => p.id !== id
              ),
            },
          };
        }),

      setActiveSection: (section) => set({ activeSection: section }),

      setSelectedVenue: (venue) => set({ selectedVenue: venue }),

      setSelectedParticipant: (participant) => set({ selectedParticipant: participant }),

      setSearchRadius: (radius) => set({ searchRadius: radius }),

      setTravelMode: (mode) => set({ travelMode: mode }),

      setMapCenter: (center) => set({ mapCenter: center }),

      reset: () => set(initialState),
    }),
    { name: 'MeetingStore' }
  )
);
```

**Tests**: Create `src/store/useMeetingStore.test.ts`

**Verification**:
```bash
npm run type-check
npm run test
```

---

## Day 3-4: Landing Page UI

### Goal
Build the landing page with event creation functionality, following UIUX_GUIDE.md design principles.

---

### Task 2.1: Create Base UI Components (3 hours)

**Files**:
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/modal.tsx`

**Implementation Steps**:

1. **Button Component** (`src/components/ui/button.tsx`):
```typescript
import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-full font-semibold',
          'transition-all duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variants
          variant === 'primary' && [
            'bg-coral-500 text-white hover:bg-coral-600',
            'focus:ring-coral-500',
          ],
          variant === 'secondary' && [
            'bg-mint-500 text-white hover:bg-mint-600',
            'focus:ring-mint-500',
          ],
          variant === 'outline' && [
            'bg-transparent border-2 border-coral-500 text-coral-500',
            'hover:bg-coral-50',
            'focus:ring-coral-500',
          ],
          variant === 'ghost' && [
            'bg-transparent text-gray-700 hover:bg-gray-100',
            'focus:ring-gray-500',
          ],

          // Sizes
          size === 'sm' && 'px-4 py-2 text-sm',
          size === 'md' && 'px-6 py-3 text-base',
          size === 'lg' && 'px-8 py-4 text-lg',

          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
```

2. **Input Component** (`src/components/ui/input.tsx`):
```typescript
import { cn } from '@/lib/utils/cn';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'w-full px-4 py-3 rounded-2xl',
            'border-2 border-gray-200',
            'focus:border-coral-500 focus:ring-2 focus:ring-coral-200',
            'transition-all duration-200',
            'placeholder:text-gray-400',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-200',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
```

3. **Create utility helper** (`src/lib/utils/cn.ts`):
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Tests**: Create component tests for each UI component

---

### Task 2.2: Build Landing Page Components (4 hours)

**File**: `src/components/landing/hero-section.tsx`

**Implementation Steps**:

1. **Hero Section with Inputs**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';

export function HeroSection() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateEvent = async () => {
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Please enter an event name');
      return;
    }
    if (!meetingTime) {
      setError('Please select a meeting time');
      return;
    }

    setLoading(true);

    try {
      const event = await api.events.create({
        title: title.trim(),
        meetingTime: new Date(meetingTime).toISOString(),
      });

      // Store organizer token
      if (event.organizerToken) {
        localStorage.setItem(`event_${event.id}_token`, event.organizerToken);
      }

      // Redirect to event page
      router.push(`/meet/${event.id}`);
    } catch (err) {
      console.error('Failed to create event:', err);
      setError('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center space-y-8">
      {/* Cat Mascot */}
      <div className="text-8xl mb-4">🐱</div>

      {/* Title */}
      <h1 className="text-6xl font-bold bg-gradient-to-r from-coral-500 via-mint-500 to-lavender-500 bg-clip-text text-transparent">
        Where2Meet
      </h1>

      {/* Subtitle */}
      <p className="text-xl text-gray-600">
        Find the perfect meeting spot for everyone!
      </p>

      {/* Input Form */}
      <div className="space-y-4 bg-white p-8 rounded-3xl shadow-lg">
        <Input
          label="Event Name"
          placeholder="Team Lunch, Coffee Chat, Study Session..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={error && !title ? 'Event name is required' : undefined}
        />

        <Input
          label="Meeting Time"
          type="datetime-local"
          value={meetingTime}
          onChange={(e) => setMeetingTime(e.target.value)}
          error={error && !meetingTime ? 'Meeting time is required' : undefined}
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleCreateEvent}
          loading={loading}
        >
          Create Event
        </Button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 mt-12">
        <FeatureCard icon="📍" title="Find the Middle" />
        <FeatureCard icon="🗺️" title="Smart Search" />
        <FeatureCard icon="🎯" title="Easy Planning" />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
    </div>
  );
}
```

**File**: `src/components/landing/footer.tsx`

2. **Footer Component**:
```typescript
export function Footer() {
  return (
    <footer className="w-full py-8 mt-16 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
        <p className="text-sm">
          Made with 💖 by the Where2Meet Team
        </p>
        <div className="mt-2 space-x-4 text-sm">
          <a href="#" className="hover:text-coral-500 transition-colors">About</a>
          <a href="#" className="hover:text-coral-500 transition-colors">Privacy</a>
          <a href="#" className="hover:text-coral-500 transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
}
```

**File**: `src/app/(landing)/page.tsx`

3. **Update Landing Page**:
```typescript
import { HeroSection } from '@/components/landing/hero-section';
import { Footer } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
        <HeroSection />
      </main>
      <Footer />
    </div>
  );
}
```

---

### Task 2.3: Create Share Modal (2 hours)

**File**: `src/components/modals/share-modal.tsx`

**Implementation Steps**:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

export function ShareModal({ isOpen, onClose, eventId }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/meet/${eventId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">
              Event Created!
            </h2>
            <p className="text-gray-600 mt-2">
              Share this link with your participants
            </p>
          </div>

          {/* URL Display */}
          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-2xl">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
            />
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => window.location.href = `/meet/${eventId}`}
            >
              Go to Event
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Day 5: Integration & Testing

### Goal
Connect all pieces, test the flow end-to-end, and ensure mobile responsiveness.

---

### Task 3.1: Integration Testing (3 hours)

**Tests to Write**:

1. **E2E Event Creation Flow** (`src/__tests__/event-creation.test.tsx`):
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LandingPage from '@/app/(landing)/page';
import { mockStore } from '@/lib/mock/store';

describe('Event Creation Flow', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('should create event and redirect to event page', async () => {
    render(<LandingPage />);

    // Fill in event details
    const titleInput = screen.getByLabelText(/event name/i);
    const timeInput = screen.getByLabelText(/meeting time/i);

    fireEvent.change(titleInput, { target: { value: 'Team Lunch' } });
    fireEvent.change(timeInput, { target: { value: '2024-12-15T12:00' } });

    // Submit
    const createButton = screen.getByText(/create event/i);
    fireEvent.click(createButton);

    // Wait for redirect
    await waitFor(() => {
      expect(window.location.pathname).toMatch(/\/meet\//);
    });
  });

  it('should show validation errors', () => {
    render(<LandingPage />);

    const createButton = screen.getByText(/create event/i);
    fireEvent.click(createButton);

    expect(screen.getByText(/event name is required/i)).toBeInTheDocument();
  });
});
```

---

### Task 3.2: Mobile Responsive Testing (2 hours)

**Breakpoints to test**:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1024px, 1440px

**Manual Testing Checklist**:
```markdown
## Mobile (375px)
- [ ] Hero section fills screen properly
- [ ] Inputs are touch-friendly (min 44px height)
- [ ] Text is readable (min 16px)
- [ ] Buttons are easy to tap
- [ ] Modal fits on screen

## Tablet (768px)
- [ ] Layout centers properly
- [ ] Images/icons scale appropriately
- [ ] Touch targets remain adequate

## Desktop (1024px+)
- [ ] Max width constrains content
- [ ] Hover states work
- [ ] Focus states visible
```

---

### Task 3.3: Final Verification (1 hour)

**Run all checks**:
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm run test

# Build
npm run build

# Run dev server
npm run dev
```

**Manual Verification**:
1. Navigate to `http://localhost:3000`
2. Create an event
3. Verify redirect to `/meet/[id]`
4. Check that event is stored in mock data
5. Test share modal copy functionality
6. Verify on mobile device or responsive mode

---

## Success Criteria Checklist

- [ ] ✅ TypeScript: All types defined in `types/index.ts`
- [ ] ✅ Mock Store: `mockStore` handles CRUD operations
- [ ] ✅ API Client: Switches between mock/real API
- [ ] ✅ Zustand Store: State management working
- [ ] ✅ Landing Page: Displays with gradient background
- [ ] ✅ Event Creation: Form validates and creates events
- [ ] ✅ Share Modal: Copy functionality works
- [ ] ✅ Responsive: Works on mobile (375px), tablet (768px), desktop (1024px+)
- [ ] ✅ `npm run type-check` passes
- [ ] ✅ `npm run lint` passes
- [ ] ✅ `npm run test` passes (>80% coverage)
- [ ] ✅ Design matches UIUX_GUIDE.md (warm colors, rounded shapes, cat theme)

---

## Next Steps

After completing Milestone 1:
1. Update MILESTONE.md status to ✅ Completed
2. Commit all changes
3. Begin Milestone 2: Main App Layout & Header

---

## Notes

- Use console.log to verify mock API calls during development
- Keep components small and focused (single responsibility)
- Follow TDD: write tests before implementation when possible
- Refer to UIUX_GUIDE.md for design decisions
- All colors should use Tailwind's custom palette (coral, mint, sunshine, lavender)
- Maintain rounded, soft aesthetic throughout

---

**Last Updated**: 2024-11-22
**Status**: Ready for Implementation
