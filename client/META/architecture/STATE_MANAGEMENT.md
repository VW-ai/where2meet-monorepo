# State Management Guide

This document outlines state management patterns for Where2Meet using **Zustand** for client state and **TanStack Query (React Query)** for server state.

## Table of Contents
1. [Philosophy](#philosophy)
2. [Zustand Store Structure](#zustand-store-structure)
3. [State Updates](#state-updates)
4. [Selectors](#selectors)
5. [Server State with React Query](#server-state-with-react-query)
6. [Best Practices](#best-practices)
7. [Testing State](#testing-state)

---

## Philosophy

Where2Meet uses a **hybrid state management approach**:

- **Zustand**: For client-side, synchronous state (participants, UI state, computed values)
- **React Query**: For server-side, asynchronous state (API calls, caching)

### Why Zustand?
- Lightweight and simple
- No Provider boilerplate
- Direct state access outside React components
- Perfect for small to medium apps
- TypeScript-first

### Why React Query?
- Handles caching, refetching, and background updates
- Built-in loading and error states
- Automatic retry logic
- Optimistic updates support

---

## Zustand Store Structure

### Primary Store: `useMeetingStore`

**Location**: `src/store/useMeetingStore.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { calculateCentroid, calculateBoundingCircle } from '@/lib/algorithms';

interface Participant {
  id: string;
  name?: string; // Optional display name
  lat: number;
  lng: number;
  address: string;
  addedAt: Date;
}

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
}

interface MeetingState {
  // Participant State
  participants: Participant[];

  // Computed State
  centroid: { lat: number; lng: number } | null;
  boundingCircle: { center: { lat: number; lng: number }; radius: number } | null;

  // Search State
  searchRadius: number; // in meters
  selectedCategory: string | null;

  // Venue State
  venues: PlaceResult[];
  selectedVenue: PlaceResult | null;

  // UI State
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  sidebarCollapsed: boolean;

  // Actions
  addParticipant: (location: Omit<Participant, 'id' | 'addedAt'>) => void;
  removeParticipant: (id: string) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  clearParticipants: () => void;

  updateCentroid: () => void;

  setSearchRadius: (radius: number) => void;
  setSelectedCategory: (category: string | null) => void;

  setVenues: (venues: PlaceResult[]) => void;
  setSelectedVenue: (venue: PlaceResult | null) => void;

  setMapCenter: (center: { lat: number; lng: number }) => void;
  setMapZoom: (zoom: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Utility Actions
  reset: () => void;
  exportState: () => string; // For URL sharing
  importState: (state: string) => void;
}

const initialState = {
  participants: [],
  centroid: null,
  boundingCircle: null,
  searchRadius: 1000,
  selectedCategory: null,
  venues: [],
  selectedVenue: null,
  mapCenter: { lat: 40.7589, lng: -73.9851 }, // Times Square, NYC
  mapZoom: 12,
  sidebarCollapsed: false,
};

export const useMeetingStore = create<MeetingState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Participant Actions
      addParticipant: (location) => {
        const newParticipant: Participant = {
          id: crypto.randomUUID(),
          addedAt: new Date(),
          ...location,
        };

        set((state) => ({
          participants: [...state.participants, newParticipant],
        }));

        // Automatically update centroid when participants change
        get().updateCentroid();
      },

      removeParticipant: (id) => {
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== id),
        }));

        get().updateCentroid();
      },

      updateParticipant: (id, updates) => {
        set((state) => ({
          participants: state.participants.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));

        get().updateCentroid();
      },

      clearParticipants: () => {
        set({
          participants: [],
          centroid: null,
          boundingCircle: null,
          venues: [],
          selectedVenue: null,
        });
      },

      // Centroid Calculation
      updateCentroid: () => {
        const { participants } = get();

        if (participants.length === 0) {
          set({ centroid: null, boundingCircle: null });
          return;
        }

        const points = participants.map((p) => ({ lat: p.lat, lng: p.lng }));

        const centroid = calculateCentroid(points);
        const boundingCircle = calculateBoundingCircle(points);

        set({ centroid, boundingCircle });

        // Auto-center map on centroid
        if (centroid) {
          set({ mapCenter: centroid });
        }
      },

      // Search Actions
      setSearchRadius: (radius) => set({ searchRadius: radius }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),

      // Venue Actions
      setVenues: (venues) => set({ venues }),
      setSelectedVenue: (venue) => set({ selectedVenue: venue }),

      // Map Actions
      setMapCenter: (center) => set({ mapCenter: center }),
      setMapZoom: (zoom) => set({ mapZoom: zoom }),

      // UI Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Utility Actions
      reset: () => set(initialState),

      exportState: () => {
        const { participants, searchRadius, selectedCategory } = get();
        return btoa(JSON.stringify({ participants, searchRadius, selectedCategory }));
      },

      importState: (state) => {
        try {
          const decoded = JSON.parse(atob(state));
          set({
            participants: decoded.participants || [],
            searchRadius: decoded.searchRadius || 1000,
            selectedCategory: decoded.selectedCategory || null,
          });
          get().updateCentroid();
        } catch (error) {
          console.error('Failed to import state:', error);
        }
      },
    }),
    { name: 'meeting-store' }
  )
);
```

---

## State Updates

### 1. Direct Updates (Synchronous)

For immediate, client-side state changes:

```tsx
import { useMeetingStore } from '@/store/useMeetingStore';

function AddLocationButton() {
  const addParticipant = useMeetingStore(state => state.addParticipant);

  const handleAdd = () => {
    addParticipant({
      name: 'John Doe',
      lat: 40.7589,
      lng: -73.9851,
      address: '123 Main St, New York, NY',
    });
  };

  return <button onClick={handleAdd}>Add Location</button>;
}
```

### 2. Batch Updates

For multiple related changes:

```tsx
function resetSearch() {
  const store = useMeetingStore.getState();

  store.setVenues([]);
  store.setSelectedVenue(null);
  store.setSelectedCategory(null);
}

// Or use a single action
function MyComponent() {
  const reset = useMeetingStore(state => state.reset);

  return <button onClick={reset}>Reset All</button>;
}
```

### 3. Computed Values

Zustand doesn't have built-in computed values, but you can use selectors:

```tsx
// In component
const participantCount = useMeetingStore(state => state.participants.length);

// Or create a custom hook
export function useParticipantCount() {
  return useMeetingStore(state => state.participants.length);
}

// For more complex computations
export function useAverageDistance() {
  const participants = useMeetingStore(state => state.participants);
  const centroid = useMeetingStore(state => state.centroid);

  return useMemo(() => {
    if (!centroid || participants.length === 0) return 0;

    const distances = participants.map(p =>
      calculateDistance(p, centroid)
    );

    return distances.reduce((sum, d) => sum + d, 0) / distances.length;
  }, [participants, centroid]);
}
```

---

## Selectors

### Basic Selector Pattern

```tsx
// ✅ Good: Select only what you need
const participants = useMeetingStore(state => state.participants);

// ❌ Bad: Selecting the entire store
const store = useMeetingStore();
```

### Multiple Selectors

```tsx
// ✅ Good: Multiple specific selectors
const participants = useMeetingStore(state => state.participants);
const centroid = useMeetingStore(state => state.centroid);
const venues = useMeetingStore(state => state.venues);

// ✅ Also good: Object selector (re-renders only when selected values change)
const { participants, centroid, venues } = useMeetingStore(state => ({
  participants: state.participants,
  centroid: state.centroid,
  venues: state.venues,
}), shallow); // Use shallow comparison from zustand/shallow

// ❌ Bad: Will re-render on any state change
const { participants, centroid, venues } = useMeetingStore();
```

### Derived Selectors

```tsx
// Custom selector hook
export function useHasParticipants() {
  return useMeetingStore(state => state.participants.length > 0);
}

export function useCanSearch() {
  return useMeetingStore(state =>
    state.participants.length >= 2 && state.centroid !== null
  );
}

// Usage
function SearchButton() {
  const canSearch = useCanSearch();

  return (
    <button disabled={!canSearch}>
      Search Venues
    </button>
  );
}
```

---

## Server State with React Query

### 1. Basic Query

```tsx
import { useQuery } from '@tanstack/react-query';

export function usePlaceSearch(params: {
  location: { lat: number; lng: number } | null;
  radius: number;
  type: string | null;
}) {
  return useQuery({
    queryKey: ['places', params.location, params.radius, params.type],
    queryFn: async () => {
      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch places');
      }

      return response.json();
    },
    enabled: !!params.location && !!params.type, // Only fetch when conditions are met
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Usage in component
function VenueSearch() {
  const centroid = useMeetingStore(state => state.centroid);
  const searchRadius = useMeetingStore(state => state.searchRadius);
  const selectedCategory = useMeetingStore(state => state.selectedCategory);

  const { data, isLoading, error } = usePlaceSearch({
    location: centroid,
    radius: searchRadius,
    type: selectedCategory,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message="Failed to load venues" />;

  return <VenueList venues={data?.results || []} />;
}
```

### 2. Mutation (For Future Features)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSaveSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: SessionData) => {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) throw new Error('Failed to save session');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

// Usage
function SaveButton() {
  const participants = useMeetingStore(state => state.participants);
  const { mutate, isPending } = useSaveSession();

  const handleSave = () => {
    mutate({ participants });
  };

  return (
    <button onClick={handleSave} disabled={isPending}>
      {isPending ? 'Saving...' : 'Save Session'}
    </button>
  );
}
```

### 3. Optimistic Updates

```tsx
export function useDeleteParticipant() {
  const queryClient = useQueryClient();
  const removeParticipant = useMeetingStore(state => state.removeParticipant);

  return useMutation({
    mutationFn: async (id: string) => {
      // API call (if backend exists)
      const response = await fetch(`/api/participants/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return id;
    },
    onMutate: async (id) => {
      // Optimistically update UI
      removeParticipant(id);
    },
    onError: (error, id, context) => {
      // Rollback on error (add participant back)
      // You'd need to store the participant in context
    },
  });
}
```

---

## Best Practices

### 1. State Organization

**DO**: Separate concerns
```typescript
// ✅ Good: Single source of truth for each domain
interface MeetingState {
  participants: Participant[];      // Domain: Participants
  centroid: { lat, lng } | null;    // Domain: Computation
  venues: PlaceResult[];            // Domain: Venues
  mapCenter: { lat, lng };          // Domain: UI
}
```

**DON'T**: Duplicate state
```typescript
// ❌ Bad: Duplicate data
interface BadState {
  participants: Participant[];
  participantLocations: { lat, lng }[]; // Duplicate of participants
}
```

### 2. Action Naming

- Use verb prefixes: `add`, `remove`, `update`, `set`, `toggle`
- Be specific: `addParticipant` not `add`
- Group related actions

```typescript
// ✅ Good
addParticipant()
removeParticipant()
updateParticipant()

// ❌ Bad
add()
delete()
modify()
```

### 3. Avoid Side Effects in Selectors

```typescript
// ❌ Bad: Side effect in selector
const participants = useMeetingStore(state => {
  console.log('Participants changed:', state.participants); // Side effect!
  return state.participants;
});

// ✅ Good: Use useEffect for side effects
const participants = useMeetingStore(state => state.participants);

useEffect(() => {
  console.log('Participants changed:', participants);
}, [participants]);
```

### 4. Immutable Updates

Zustand uses immer internally, but be explicit:

```typescript
// ✅ Good: Immutable
addParticipant: (location) => set((state) => ({
  participants: [...state.participants, newParticipant],
})),

// ❌ Bad: Mutating
addParticipant: (location) => set((state) => {
  state.participants.push(newParticipant); // Mutation!
  return state;
}),
```

### 5. TypeScript First

Always define types:

```typescript
// ✅ Good
interface MeetingState {
  participants: Participant[];
  addParticipant: (location: Omit<Participant, 'id' | 'addedAt'>) => void;
}

// ❌ Bad
const useMeetingStore = create((set) => ({
  participants: [],
  addParticipant: (location: any) => { /* ... */ },
}));
```

### 6. Persist State (Optional)

For saving state to localStorage:

```typescript
import { persist } from 'zustand/middleware';

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'meeting-storage', // localStorage key
      partialize: (state) => ({
        participants: state.participants,
        searchRadius: state.searchRadius,
        // Don't persist UI state
      }),
    }
  )
);
```

---

## Testing State

### 1. Testing Store Actions

```typescript
import { useMeetingStore } from '@/store/useMeetingStore';

describe('useMeetingStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useMeetingStore.getState().reset();
  });

  it('should add a participant', () => {
    const { addParticipant, participants } = useMeetingStore.getState();

    addParticipant({
      name: 'Test User',
      lat: 40.7589,
      lng: -73.9851,
      address: 'Test Address',
    });

    expect(useMeetingStore.getState().participants).toHaveLength(1);
    expect(useMeetingStore.getState().participants[0].name).toBe('Test User');
  });

  it('should update centroid when adding participants', () => {
    const { addParticipant, centroid } = useMeetingStore.getState();

    expect(centroid).toBeNull();

    addParticipant({
      lat: 40.7589,
      lng: -73.9851,
      address: 'Location 1',
    });

    expect(useMeetingStore.getState().centroid).not.toBeNull();
  });

  it('should remove a participant', () => {
    const { addParticipant, removeParticipant } = useMeetingStore.getState();

    addParticipant({
      lat: 40.7589,
      lng: -73.9851,
      address: 'Test',
    });

    const id = useMeetingStore.getState().participants[0].id;
    removeParticipant(id);

    expect(useMeetingStore.getState().participants).toHaveLength(0);
  });
});
```

### 2. Testing with React Components

```tsx
import { renderHook, act } from '@testing-library/react';
import { useMeetingStore } from '@/store/useMeetingStore';

describe('useParticipantCount', () => {
  it('should return correct participant count', () => {
    const { result } = renderHook(() =>
      useMeetingStore(state => state.participants.length)
    );

    expect(result.current).toBe(0);

    act(() => {
      useMeetingStore.getState().addParticipant({
        lat: 40,
        lng: -73,
        address: 'Test',
      });
    });

    expect(result.current).toBe(1);
  });
});
```

### 3. Testing React Query Hooks

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePlaceSearch', () => {
  it('should fetch places', async () => {
    const { result } = renderHook(
      () => usePlaceSearch({
        location: { lat: 40.7589, lng: -73.9851 },
        radius: 1000,
        type: 'restaurant',
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });
});
```

---

## State Flow Diagram

```
User Action
    ↓
Component Handler
    ↓
Zustand Action ──────→ State Update
    ↓                       ↓
Update Centroid      Re-render Components
    ↓
Trigger React Query
    ↓
API Call
    ↓
Update Venues (Zustand)
    ↓
Re-render Venue List
```

---

## Quick Reference

### Common Patterns

```tsx
// Get state value
const participants = useMeetingStore(state => state.participants);

// Get action
const addParticipant = useMeetingStore(state => state.addParticipant);

// Get multiple values
const { participants, centroid } = useMeetingStore(
  state => ({ participants: state.participants, centroid: state.centroid }),
  shallow
);

// Access store outside React
const currentState = useMeetingStore.getState();
currentState.addParticipant({ ... });

// Subscribe to changes outside React
const unsubscribe = useMeetingStore.subscribe(
  (state) => console.log('State changed:', state)
);

// React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['key'],
  queryFn: fetchData,
});

// Mutations
const { mutate, isPending } = useMutation({
  mutationFn: postData,
  onSuccess: () => { /* ... */ },
});
```
