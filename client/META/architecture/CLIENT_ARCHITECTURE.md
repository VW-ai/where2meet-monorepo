# Where2Meet - Client Architecture

> **Frontend-Only Application**
> Next.js 14 App Router | TypeScript | Tailwind CSS | Google Maps | External Backend API

## Table of Contents
1. [Project Structure Overview](#project-structure-overview)
2. [Detailed Folder Breakdown](#detailed-folder-breakdown)
3. [File Naming Conventions](#file-naming-conventions)
4. [Component Organization](#component-organization)
5. [State Management](#state-management)
6. [API Integration with External Backend](#api-integration-with-external-backend)
7. [Configuration Files](#configuration-files)

---

## Project Structure Overview

```
where2meet-v1.0-client/
├── .next/                      # Next.js build output (auto-generated)
├── node_modules/               # Dependencies (auto-generated)
├── public/                     # Static assets
│   ├── images/
│   │   ├── cat-mascot/         # Cat mascot SVGs and PNGs
│   │   ├── avatars/            # Cat avatar variations
│   │   └── og-image.png        # Open Graph image
│   ├── icons/                  # App icons, favicon
│   └── fonts/                  # Custom fonts (if any)
│
├── src/
│   ├── app/                    # Next.js 14 App Router (Pages Only)
│   │   ├── (landing)/          # Route group - Landing page
│   │   │   ├── page.tsx        # Landing page (/)
│   │   │   └── layout.tsx      # Landing-specific layout
│   │   │
│   │   ├── meet/               # Main app routes
│   │   │   └── [id]/           # Dynamic route for events
│   │   │       ├── page.tsx    # Main app interface
│   │   │       └── loading.tsx # Loading state
│   │   │
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles, Tailwind imports
│   │   ├── error.tsx           # Global error boundary
│   │   └── not-found.tsx       # 404 page
│   │
│   ├── components/             # React components
│   │   ├── landing/            # Landing page components
│   │   │   ├── hero-input.tsx
│   │   │   ├── action-buttons.tsx
│   │   │   ├── share-modal.tsx
│   │   │   └── footer.tsx
│   │   │
│   │   ├── header/             # Header components
│   │   │   ├── index.tsx
│   │   │   ├── pill-nav.tsx
│   │   │   ├── filter-pills.tsx
│   │   │   ├── settings-dropdown.tsx
│   │   │   └── top-right-actions.tsx
│   │   │
│   │   ├── sidebar/            # Sidebar components
│   │   │   ├── index.tsx
│   │   │   ├── mode-toggle.tsx
│   │   │   │
│   │   │   ├── participant/    # Participant section
│   │   │   │   ├── add-participant.tsx
│   │   │   │   ├── participant-list.tsx
│   │   │   │   ├── participant-item.tsx
│   │   │   │   ├── analysis-component.tsx
│   │   │   │   ├── time-distance-chart.tsx
│   │   │   │   └── participant-time-chart.tsx
│   │   │   │
│   │   │   └── venue/          # Venue section
│   │   │       ├── travel-type-filter.tsx
│   │   │       ├── search-pill-bar.tsx
│   │   │       ├── venue-list.tsx
│   │   │       ├── venue-card.tsx
│   │   │       └── venue-info-panel.tsx
│   │   │
│   │   ├── map/                # Map components
│   │   │   ├── index.tsx
│   │   │   ├── google-map-container.tsx
│   │   │   ├── participant-marker.tsx
│   │   │   ├── venue-marker.tsx
│   │   │   ├── mec-circle.tsx
│   │   │   ├── search-radius-circle.tsx
│   │   │   ├── route-display.tsx
│   │   │   └── venue-popup.tsx
│   │   │
│   │   ├── modals/             # Modal components
│   │   │   ├── modal-wrapper.tsx
│   │   │   ├── share-modal.tsx
│   │   │   ├── edit-event-modal.tsx
│   │   │   ├── delete-confirmation-modal.tsx
│   │   │   └── publish-modal.tsx
│   │   │
│   │   ├── ui/                 # Reusable UI components (shadcn/ui style)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── spinner.tsx
│   │   │
│   │   └── cat/                # Cat theme components
│   │       ├── cat-tail.tsx
│   │       ├── cat-ears.tsx
│   │       ├── cat-feet.tsx
│   │       └── cat-avatar.tsx
│   │
│   ├── lib/                    # Utility functions and helpers
│   │   ├── api/                # API client for external backend
│   │   │   ├── client.ts       # Main API client (switches mock/real)
│   │   │   ├── mock-client.ts  # Mock API implementation
│   │   │   ├── endpoints.ts    # API endpoint constants
│   │   │   ├── events.ts       # Event API calls
│   │   │   ├── participants.ts # Participant API calls
│   │   │   ├── venues.ts       # Venue API calls
│   │   │   └── places.ts       # Google Places API wrapper (client-side)
│   │   │
│   │   ├── mock/               # Mock data layer (for development)
│   │   │   ├── data/           # Static mock data
│   │   │   │   ├── events.ts   # Sample events
│   │   │   │   ├── participants.ts # Sample participants
│   │   │   │   ├── venues.ts   # Sample venues
│   │   │   │   └── index.ts    # Export all mock data
│   │   │   │
│   │   │   ├── handlers/       # Mock API route handlers (optional)
│   │   │   │   ├── events.ts   # Event CRUD handlers
│   │   │   │   ├── participants.ts # Participant handlers
│   │   │   │   ├── venues.ts   # Venue search handlers
│   │   │   │   └── geocoding.ts # Geocoding mock
│   │   │   │
│   │   │   └── store.ts        # In-memory mock data store
│   │   │
│   │   ├── map/                # Map utilities
│   │   │   ├── calculate-mec.ts        # Minimum Enclosing Circle algorithm
│   │   │   ├── geocoding.ts            # Address <-> Coordinates
│   │   │   ├── directions.ts           # Route calculations
│   │   │   ├── distance-matrix.ts      # Travel time calculations
│   │   │   └── map-styles.ts           # Custom map styling
│   │   │
│   │   ├── utils/              # General utilities
│   │   │   ├── cn.ts           # classnames utility (clsx + tailwind-merge)
│   │   │   ├── colors.ts       # Cat color generation
│   │   │   ├── formatters.ts   # Date, time, distance formatters
│   │   │   ├── validators.ts   # Input validation
│   │   │   └── random-names.ts # Random name generator (dice feature)
│   │   │
│   │   └── hooks/              # Custom React hooks
│   │       ├── use-event.ts            # Event data hook
│   │       ├── use-participants.ts     # Participants management
│   │       ├── use-venues.ts           # Venue search hook
│   │       ├── use-map.ts              # Map state hook
│   │       ├── use-google-maps.ts      # Google Maps initialization
│   │       ├── use-debounce.ts         # Debounce hook
│   │       ├── use-local-storage.ts    # LocalStorage hook
│   │       └── use-media-query.ts      # Responsive breakpoint hook
│   │
│   ├── store/                  # State management (Zustand)
│   │   ├── event-store.ts      # Event state
│   │   ├── participant-store.ts # Participant state
│   │   ├── venue-store.ts      # Venue state
│   │   ├── map-store.ts        # Map state
│   │   ├── ui-store.ts         # UI state (modals, sidebars)
│   │   └── index.ts            # Combined store exports
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── event.ts            # Event types
│   │   ├── participant.ts      # Participant types
│   │   ├── venue.ts            # Venue types
│   │   ├── map.ts              # Map-related types
│   │   ├── api.ts              # API request/response types
│   │   └── index.ts            # Type exports
│   │
│   ├── constants/              # Constants and configuration
│   │   ├── colors.ts           # Cat color palette
│   │   ├── map.ts              # Map default settings
│   │   ├── routes.ts           # Route paths
│   │   └── config.ts           # App configuration
│   │
│   └── middleware.ts           # Next.js middleware (optional)
│
├── .env.local                  # Environment variables (local, not committed)
├── .env.example                # Example environment variables
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore rules
├── .prettierrc                 # Prettier configuration
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation
```

---

## Detailed Folder Breakdown

### `/public/` - Static Assets

Static files served directly by Next.js. Accessible via `/filename`.

```
public/
├── images/
│   ├── cat-mascot/
│   │   ├── logo.svg              # Main cat logo
│   │   ├── logo-light.svg        # Light theme variant
│   │   └── logo-icon.svg         # Icon only
│   │
│   ├── avatars/
│   │   ├── cat-happy.svg
│   │   ├── cat-excited.svg
│   │   ├── cat-sleepy.svg
│   │   ├── cat-surprised.svg
│   │   ├── cat-cool.svg
│   │   └── ...                   # 10-12 cat variations
│   │
│   └── og-image.png              # Social media preview (1200x630)
│
├── icons/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
│
└── fonts/                        # Custom fonts (if not using Google Fonts)
    └── ...
```

**Usage:**
```tsx
<Image src="/images/cat-mascot/logo.svg" alt="Where2Meet" />
```

---

### `/src/app/` - Next.js 14 App Router (Pages Only)

Client-side pages using the App Router. **No API routes** - all backend calls go to external API.

#### Route Groups

```tsx
// (landing) - Route group (doesn't affect URL)
app/
├── (landing)/
│   ├── page.tsx        // Route: /
│   └── layout.tsx      // Layout for landing page
│
└── meet/
    └── [id]/
        └── page.tsx    // Route: /meet/:id
```

**Route Groups** use `(name)` to organize files without affecting the URL structure.

#### Example Files

**`app/layout.tsx`** (Root Layout):
```tsx
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Where2Meet - Find the Perfect Meeting Spot',
  description: 'Collaborative meeting location finder',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**`app/(landing)/page.tsx`**:
```tsx
'use client';

import HeroInput from '@/components/landing/hero-input';
import Footer from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <HeroInput />
      <Footer />
    </main>
  );
}
```

**`app/meet/[id]/page.tsx`**:
```tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import MapArea from '@/components/map';
import { useEventStore } from '@/store/event-store';
import { getEvent } from '@/lib/api/events';

export default function MeetPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { setEvent } = useEventStore();

  useEffect(() => {
    // Fetch event from backend API
    async function loadEvent() {
      try {
        const event = await getEvent(eventId);
        setEvent(event);
      } catch (error) {
        console.error('Failed to load event:', error);
      }
    }

    loadEvent();
  }, [eventId, setEvent]);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <MapArea />
      </div>
    </div>
  );
}
```

---

### `/src/components/` - React Components

Organized by feature/section.

#### Component Structure

Each major component should have its own file:

```
components/
├── sidebar/
│   ├── index.tsx                 # Main Sidebar component (barrel export)
│   ├── mode-toggle.tsx           # Standalone component
│   │
│   ├── participant/
│   │   ├── add-participant.tsx
│   │   ├── participant-list.tsx
│   │   └── participant-item.tsx
│   │
│   └── venue/
│       ├── venue-list.tsx
│       └── venue-card.tsx
```

**`components/sidebar/index.tsx`**:
```tsx
'use client';

import ModeToggle from './mode-toggle';
import ParticipantSection from './participant/participant-list';
import VenueSection from './venue/venue-list';
import { useUIStore } from '@/store/ui-store';

export default function Sidebar() {
  const activeView = useUIStore((state) => state.activeView);

  return (
    <aside className="w-full md:w-[30%] border-r border-border overflow-y-auto">
      <div className="p-6 space-y-6">
        <ModeToggle />
        {activeView === 'participant' ? <ParticipantSection /> : <VenueSection />}
      </div>
    </aside>
  );
}
```

#### UI Components (`/components/ui/`)

Reusable, generic UI components (similar to shadcn/ui pattern):

```tsx
// components/ui/button.tsx
import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-full font-medium transition-all',
        variant === 'primary' && 'bg-coral-500 hover:bg-coral-600 text-white',
        variant === 'secondary' && 'bg-white border-2 border-border hover:border-coral-500',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-6 py-2.5 text-base',
        size === 'lg' && 'px-8 py-3 text-lg',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

**Usage:**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="primary" size="md">Create Event</Button>
```

---

### `/src/lib/api/` - External Backend API Client

All API calls go to your external backend server.

#### Base API Client

```tsx
// lib/api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class APIError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'APIError';
  }
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Include cookies if needed
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      errorData.message || `API Error: ${response.statusText}`,
      errorData
    );
  }

  return response.json();
}
```

#### Event API

```tsx
// lib/api/events.ts
import { apiCall } from './client';
import { Event, CreateEventInput } from '@/types';

export async function createEvent(input: CreateEventInput): Promise<Event> {
  return apiCall<Event>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getEvent(id: string): Promise<Event> {
  return apiCall<Event>(`/api/events/${id}`);
}

export async function updateEvent(id: string, data: Partial<Event>): Promise<Event> {
  return apiCall<Event>(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  return apiCall<void>(`/api/events/${id}`, {
    method: 'DELETE',
  });
}

export async function publishEvent(id: string, venueId: string): Promise<Event> {
  return apiCall<Event>(`/api/events/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ venueId }),
  });
}
```

#### Participant API

```tsx
// lib/api/participants.ts
import { apiCall } from './client';
import { Participant, ParticipantInput } from '@/types';

export async function addParticipant(
  eventId: string,
  input: ParticipantInput
): Promise<Participant> {
  return apiCall<Participant>(`/api/events/${eventId}/participants`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeParticipant(
  eventId: string,
  participantId: string
): Promise<void> {
  return apiCall<void>(`/api/events/${eventId}/participants/${participantId}`, {
    method: 'DELETE',
  });
}
```

#### Venue API

```tsx
// lib/api/venues.ts
import { apiCall } from './client';
import { Venue } from '@/types';

export async function searchVenues(params: {
  eventId: string;
  center: { lat: number; lng: number };
  radius: number;
  category?: string;
}): Promise<Venue[]> {
  const queryString = new URLSearchParams({
    lat: params.center.lat.toString(),
    lng: params.center.lng.toString(),
    radius: params.radius.toString(),
    ...(params.category && { category: params.category }),
  }).toString();

  return apiCall<Venue[]>(`/api/events/${params.eventId}/venues?${queryString}`);
}

export async function voteForVenue(
  eventId: string,
  venueId: string
): Promise<void> {
  return apiCall<void>(`/api/events/${eventId}/venues/${venueId}/vote`, {
    method: 'POST',
  });
}
```

---

### `/src/lib/map/` - Client-Side Map Utilities

Google Maps operations done on the client-side.

```tsx
// lib/map/calculate-mec.ts
import { Participant } from '@/types';

export interface Circle {
  center: { lat: number; lng: number };
  radius: number; // in meters
}

export function calculateMEC(participants: Participant[]): Circle {
  if (participants.length === 0) {
    return { center: { lat: 0, lng: 0 }, radius: 0 };
  }

  if (participants.length === 1) {
    return {
      center: participants[0].location,
      radius: 1000, // 1km default
    };
  }

  // Welzl's algorithm for Minimum Enclosing Circle
  // Simplified implementation
  const lats = participants.map(p => p.location.lat);
  const lngs = participants.map(p => p.location.lng);

  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

  const center = { lat: centerLat, lng: centerLng };

  // Calculate max distance from center
  const distances = participants.map(p => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = center.lat * Math.PI / 180;
    const φ2 = p.location.lat * Math.PI / 180;
    const Δφ = (p.location.lat - center.lat) * Math.PI / 180;
    const Δλ = (p.location.lng - center.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  });

  const radius = Math.max(...distances) * 1.1; // Add 10% buffer

  return { center, radius };
}
```

```tsx
// lib/map/geocoding.ts
export async function geocodeAddress(address: string) {
  if (!window.google) {
    throw new Error('Google Maps not loaded');
  }

  const geocoder = new google.maps.Geocoder();

  return new Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
  }>((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        resolve({
          lat: location.lat(),
          lng: location.lng(),
          formattedAddress: results[0].formatted_address,
        });
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
}
```

```tsx
// lib/map/directions.ts
import { TravelMode } from '@/types';

export async function calculateRoute(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode: TravelMode;
}) {
  if (!window.google) {
    throw new Error('Google Maps not loaded');
  }

  const directionsService = new google.maps.DirectionsService();

  const travelModeMap: Record<TravelMode, google.maps.TravelMode> = {
    car: google.maps.TravelMode.DRIVING,
    transit: google.maps.TravelMode.TRANSIT,
    walk: google.maps.TravelMode.WALKING,
    bike: google.maps.TravelMode.BICYCLING,
  };

  return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    directionsService.route(
      {
        origin: params.origin,
        destination: params.destination,
        travelMode: travelModeMap[params.travelMode],
      },
      (result, status) => {
        if (status === 'OK' && result) {
          resolve(result);
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      }
    );
  });
}
```

---

### `/src/lib/hooks/` - Custom React Hooks

```tsx
// lib/hooks/use-event.ts
'use client';

import { useState, useEffect } from 'react';
import { getEvent } from '@/lib/api/events';
import { Event } from '@/types';

export function useEvent(eventId: string) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        setLoading(true);
        const data = await getEvent(eventId);
        setEvent(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await getEvent(eventId);
      setEvent(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { event, loading, error, refetch };
}
```

```tsx
// lib/hooks/use-google-maps.ts
'use client';

import { useEffect, useState } from 'react';

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => setIsLoaded(true);
    script.onerror = () => setLoadError(new Error('Failed to load Google Maps'));

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return { isLoaded, loadError };
}
```

---

### `/src/store/` - State Management (Zustand)

Global state management using Zustand.

```tsx
// store/event-store.ts
import { create } from 'zustand';
import { Event } from '@/types';

interface EventStore {
  event: Event | null;
  setEvent: (event: Event) => void;
  updateEvent: (updates: Partial<Event>) => void;
  clearEvent: () => void;
}

export const useEventStore = create<EventStore>((set) => ({
  event: null,

  setEvent: (event) => set({ event }),

  updateEvent: (updates) =>
    set((state) => ({
      event: state.event ? { ...state.event, ...updates } : null,
    })),

  clearEvent: () => set({ event: null }),
}));
```

```tsx
// store/participant-store.ts
import { create } from 'zustand';
import { Participant } from '@/types';

interface ParticipantStore {
  participants: Participant[];
  selectedParticipant: string | null;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  selectParticipant: (id: string | null) => void;
}

export const useParticipantStore = create<ParticipantStore>((set) => ({
  participants: [],
  selectedParticipant: null,

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  selectParticipant: (id) => set({ selectedParticipant: id }),
}));
```

```tsx
// store/ui-store.ts
import { create } from 'zustand';

type ActiveView = 'participant' | 'venue';

interface UIStore {
  activeView: ActiveView;
  isShareModalOpen: boolean;
  isAnalysisOpen: boolean;
  isVenueInfoOpen: boolean;
  selectedVenueId: string | null;

  setActiveView: (view: ActiveView) => void;
  toggleShareModal: () => void;
  toggleAnalysis: () => void;
  openVenueInfo: (venueId: string) => void;
  closeVenueInfo: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: 'participant',
  isShareModalOpen: false,
  isAnalysisOpen: false,
  isVenueInfoOpen: false,
  selectedVenueId: null,

  setActiveView: (view) => set({ activeView: view }),
  toggleShareModal: () => set((state) => ({ isShareModalOpen: !state.isShareModalOpen })),
  toggleAnalysis: () => set((state) => ({ isAnalysisOpen: !state.isAnalysisOpen })),

  openVenueInfo: (venueId) =>
    set({ isVenueInfoOpen: true, selectedVenueId: venueId }),

  closeVenueInfo: () =>
    set({ isVenueInfoOpen: false, selectedVenueId: null }),
}));
```

**Usage in Components:**
```tsx
'use client';

import { useParticipantStore } from '@/store/participant-store';

export default function ParticipantList() {
  const participants = useParticipantStore((state) => state.participants);
  const addParticipant = useParticipantStore((state) => state.addParticipant);

  return (
    <div>
      {participants.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  );
}
```

---

### `/src/types/` - TypeScript Types

Centralized type definitions.

```tsx
// types/participant.ts
export interface Participant {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  fuzzyLocation: boolean;
  color: string;
  avatar: number;
  createdAt: string;
}

export interface ParticipantInput {
  name: string;
  address: string;
  fuzzyLocation: boolean;
}
```

```tsx
// types/event.ts
import { Participant } from './participant';

export interface Event {
  id: string;
  title: string;
  time: string;
  organizerId: string;
  isOrganizerOnly: boolean;
  publishedVenue?: string;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  time: string;
}
```

```tsx
// types/map.ts
export type TravelMode = 'car' | 'transit' | 'walk' | 'bike';

export interface MapCircle {
  center: { lat: number; lng: number };
  radius: number;
}

export interface RouteInfo {
  participantId: string;
  venueId: string;
  distance: number; // meters
  duration: number; // seconds
  path: google.maps.LatLng[];
}
```

---

## File Naming Conventions

### General Rules

1. **Components**: `kebab-case.tsx`
   - `participant-list.tsx`
   - `venue-card.tsx`
   - `hero-input.tsx`

2. **Utilities**: `kebab-case.ts`
   - `calculate-mec.ts`
   - `random-names.ts`
   - `cn.ts`

3. **Types**: `kebab-case.ts` or singular noun
   - `participant.ts`
   - `venue.ts`
   - `event.ts`

4. **Stores**: `name-store.ts`
   - `participant-store.ts`
   - `venue-store.ts`
   - `ui-store.ts`

5. **Hooks**: `use-hook-name.ts`
   - `use-event.ts`
   - `use-participants.ts`
   - `use-debounce.ts`

6. **API**: `resource-name.ts`
   - `events.ts`
   - `participants.ts`
   - `client.ts`

---

## Component Organization

### Barrel Exports

Use `index.ts` for clean imports:

```tsx
// components/sidebar/index.tsx
export { default } from './sidebar';
export { default as ModeToggle } from './mode-toggle';
export * from './participant';
export * from './venue';
```

**Usage:**
```tsx
// ✅ Clean import
import Sidebar, { ModeToggle } from '@/components/sidebar';

// vs

// ❌ Verbose import
import Sidebar from '@/components/sidebar/sidebar';
import ModeToggle from '@/components/sidebar/mode-toggle';
```

---

## State Management

### When to Use What

**Local State (useState)**:
- Component-specific UI state
- Form inputs
- Toggle states
- Simple derived data

```tsx
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

**Global State (Zustand)**:
- Shared across multiple components
- Event data
- Participants list
- Venues list
- Selected states
- Map state
- UI state (modals, active views)

```tsx
const participants = useParticipantStore((state) => state.participants);
const addParticipant = useParticipantStore((state) => state.addParticipant);
```

**Server State (Optional - React Query)**:
If you want advanced caching and data synchronization:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['event', eventId],
  queryFn: () => getEvent(eventId),
});

const createMutation = useMutation({
  mutationFn: createEvent,
  onSuccess: (data) => {
    router.push(`/meet/${data.id}`);
  },
});
```

---

## API Integration with External Backend

### Mock Data Layer for Development

This is a **client-only repository**. To develop without depending on a backend server, we use a **mock data layer** that can be toggled via environment variable.

#### Environment Variables

```bash
# .env.local (Development with Mock API)
NEXT_PUBLIC_USE_MOCK_API=true              # Enable mock data layer
NEXT_PUBLIC_API_URL=http://localhost:8000   # Unused when mock=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key    # Required (real API key)
```

```bash
# .env.local (Development with Real Backend)
NEXT_PUBLIC_USE_MOCK_API=false             # Use real backend API
NEXT_PUBLIC_API_URL=http://localhost:8000   # Your backend URL
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
```

#### How Mock API Works

The API client automatically routes to mock or real API based on `NEXT_PUBLIC_USE_MOCK_API`:

**File: `src/lib/api/client.ts`**
```typescript
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

export async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (USE_MOCK_API) {
    // Route to mock API handlers (in-memory data)
    return mockApiCall<T>(endpoint, options);
  }

  // Real API call to external backend
  const url = `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;
  const response = await fetch(url, options);
  // ... handle response
}
```

**File: `src/lib/mock/store.ts`** (In-memory data store)
```typescript
class MockStore {
  private events: Map<string, Event> = new Map();
  private venues: Map<string, Venue> = new Map();

  constructor() {
    this.seedData(); // Initialize with sample data
  }

  getEvent(id: string) { return this.events.get(id); }
  createEvent(event: Event) { /* ... */ }
  // ... other CRUD methods
}

export const mockStore = new MockStore();
```

**File: `src/lib/api/mock-client.ts`** (Mock API handlers)
```typescript
export async function mockApiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;

  // Route to appropriate handler
  if (endpoint === '/api/events' && method === 'POST') {
    return mockStore.createEvent(body) as T;
  }

  if (endpoint.startsWith('/api/events/') && method === 'GET') {
    const id = endpoint.split('/')[3];
    return mockStore.getEvent(id) as T;
  }

  // ... other endpoints
}
```

See **[API_SPEC.md](API_SPEC.md)** for complete mock data implementation guide.

### API Client Usage Pattern

```tsx
'use client';

import { useState } from 'react';
import { createEvent } from '@/lib/api/events';
import { useRouter } from 'next/navigation';

export default function CreateEventForm() {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const event = await createEvent({ title, time });
      router.push(`/meet/${event.id}`);
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event Title"
      />
      <input
        type="datetime-local"
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}
```

### Error Handling

```tsx
import { APIError } from '@/lib/api/client';

try {
  const event = await createEvent(input);
} catch (error) {
  if (error instanceof APIError) {
    if (error.status === 401) {
      // Unauthorized
      router.push('/login');
    } else if (error.status === 400) {
      // Validation error
      console.error('Validation failed:', error.data);
    } else {
      // Other errors
      console.error('API error:', error.message);
    }
  } else {
    // Network error or other
    console.error('Unexpected error:', error);
  }
}
```

---

## Configuration Files

### `.env.local` (Environment Variables)

```bash
# Mock API Mode (set to 'true' for development without backend)
NEXT_PUBLIC_USE_MOCK_API=true

# Backend API URL (your external backend)
# Only used when NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Maps API Key (required - needed even with mock API)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** Set `NEXT_PUBLIC_USE_MOCK_API=true` to use mock data layer during development. Switch to `false` when backend API is available.

### `.env.example`

```bash
# Copy this file to .env.local and fill in your values

# Mock API Mode (set to 'true' for development without backend)
NEXT_PUBLIC_USE_MOCK_API=true

# Backend API URL (required when not using mock API)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Maps API Key (required)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'maps.googleapis.com', // Google Maps images
      'lh3.googleusercontent.com', // Google Places photos
    ],
  },

  // Enable React Strict Mode
  reactStrictMode: true,

  // Configure rewrites for API proxy (optional, if you want to proxy backend)
  async rewrites() {
    return [
      // Uncomment if you want to proxy backend through Next.js
      // {
      //   source: '/api/:path*',
      //   destination: `${process.env.API_URL}/api/:path*`,
      // },
    ];
  },
};

module.exports = nextConfig;
```

### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
        coral: {
          50: '#FFF5F5',
          100: '#FFE5E5',
          500: '#FF6B6B',
          600: '#EE5A5A',
          700: '#DD4949',
        },
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#6BCB77',
          600: '#5BB968',
        },
        border: '#E5E7EB',
        foreground: '#1F2937',
        'muted-foreground': '#6B7280',
        background: '#FFFFFF',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `package.json`

```json
{
  "name": "where2meet-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@react-google-maps/api": "^2.19.0",
    "zustand": "^4.4.0",
    "lucide-react": "^0.294.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/google.maps": "^3.55.0",
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "postcss": "^8",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.0.0"
  }
}
```

---

## Import Paths

Use TypeScript path aliases for clean imports:

```tsx
// ✅ Clean with alias
import { Button } from '@/components/ui/button';
import { useParticipantStore } from '@/store/participant-store';
import { calculateMEC } from '@/lib/map/calculate-mec';
import { Participant } from '@/types';
import { getEvent } from '@/lib/api/events';

// ❌ Messy without alias
import { Button } from '../../../components/ui/button';
import { useParticipantStore } from '../../../store/participant-store';
```

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Best Practices

### 1. Client-Side Rendering

Since this is a client-only app with an external backend, always use `'use client'` directive:

```tsx
'use client';

import { useState } from 'react';
// ... rest of component
```

### 2. API Error Handling

Always handle API errors gracefully:

```tsx
try {
  const data = await apiCall('/endpoint');
} catch (error) {
  if (error instanceof APIError) {
    // Handle specific API errors
  } else {
    // Handle network/unknown errors
  }
}
```

### 3. Loading States

Show loading states for better UX:

```tsx
const [loading, setLoading] = useState(false);

if (loading) return <Spinner />;
```

### 4. Environment Variables

Always prefix client-side env vars with `NEXT_PUBLIC_`:

```bash
NEXT_PUBLIC_API_URL=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

### 5. TypeScript Strict Mode

Keep strict mode enabled for type safety:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

---

## Summary Checklist

When setting up your client-only project:

- [ ] Use Next.js 14 App Router (`/app` directory)
- [ ] **No API routes** - all in `/src/app` are pages only
- [ ] Create API client in `/src/lib/api` pointing to external backend
- [ ] Configure `NEXT_PUBLIC_API_URL` environment variable
- [ ] Use `'use client'` directive for all interactive components
- [ ] Organize components by feature/section
- [ ] Create reusable UI components in `/components/ui`
- [ ] Use TypeScript for type safety
- [ ] Set up path aliases (`@/...`)
- [ ] Use Zustand for global state
- [ ] Keep utilities organized by purpose
- [ ] Follow kebab-case naming for files
- [ ] Use barrel exports for clean imports
- [ ] Store types in `/types` directory
- [ ] Configure Tailwind with custom theme
- [ ] Set up Google Maps client-side
- [ ] Handle API errors properly
- [ ] Show loading/error states

---

*Last Updated: 2024*
*Architecture Version: 1.0 - Client-Only*
*Stack: Next.js 14 | TypeScript | Tailwind CSS | Zustand | Google Maps | External Backend API*
