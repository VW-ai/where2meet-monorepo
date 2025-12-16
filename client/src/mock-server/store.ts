/**
 * Mock Data Store
 *
 * In-memory data store with file-based persistence
 * Simulates backend database and API operations
 */

import { Event, Participant, Location } from '@/types';
import { LegacyVenue } from '@/types/venue';
import { MOCK_VENUES } from './data/venues';
import { geocodeAddress, calculateDistance } from './services/geocoding';
import { loadDataSync, saveData, saveDataSync } from './services/persistence';

class MockDataStore {
  private events: Map<string, Event> = new Map();
  private venues: Map<string, LegacyVenue> = new Map();

  constructor() {
    this.seedInitialData();
    // Load persisted data synchronously so it's available immediately
    this.initialize();
  }

  /**
   * Initialize store by loading persisted data
   */
  private initialize() {
    try {
      console.log('[MockStore] Initializing mock store...');
      const data = loadDataSync();
      console.log('[MockStore] Loaded data from file:', Object.keys(data.events).length, 'events');
      // Restore events from persisted data
      Object.entries(data.events).forEach(([id, event]) => {
        this.events.set(id, event);
        console.log('[MockStore] Restored event:', id);
      });
      console.log(`[MockStore] ✓ Loaded ${this.events.size} events from persistence`);
    } catch (error) {
      console.error('[MockStore] ✗ Failed to load persisted data:', error);
    }
  }

  /**
   * Persist current state to file
   */
  private async persist() {
    try {
      const data = {
        events: Object.fromEntries(this.events),
      };
      await saveData(data);
    } catch (error) {
      console.error('[MockStore] Failed to persist data:', error);
    }
  }

  /**
   * Seed the store with initial mock data
   */
  private seedInitialData() {
    // Seed venues
    MOCK_VENUES.forEach((venue) => {
      this.venues.set(venue.id, venue);
    });
  }

  // ============================================================================
  // Event Operations
  // ============================================================================

  createEvent(data: Omit<Event, 'id' | 'createdAt' | 'participants'>): Event {
    const newEvent: Event = {
      ...data,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      participants: [],
    };
    this.events.set(newEvent.id, newEvent);
    console.log('[MockStore] Event created:', newEvent.id);
    // Persist synchronously to ensure event is immediately available
    const persistData = {
      events: Object.fromEntries(this.events),
    };
    saveDataSync(persistData);
    return newEvent;
  }

  getEvent(id: string): Event | undefined {
    // Reload data from file to handle Turbopack module instance issues
    try {
      const data = loadDataSync();
      Object.entries(data.events).forEach(([eventId, event]) => {
        this.events.set(eventId, event);
      });
    } catch (error) {
      console.error('[MockStore] Failed to reload data:', error);
    }

    console.log('[MockStore] getEvent called for:', id);
    console.log('[MockStore] Total events in store:', this.events.size);
    console.log('[MockStore] Available event IDs:', Array.from(this.events.keys()));
    const event = this.events.get(id);
    console.log('[MockStore] Event found:', event ? 'YES' : 'NO');
    return event;
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
    console.log('[MockStore] Event updated:', id);
    // Persist to file (fire and forget)
    this.persist();
    return updatedEvent;
  }

  deleteEvent(id: string): boolean {
    const deleted = this.events.delete(id);
    if (deleted) {
      console.log('[MockStore] Event deleted:', id);
      // Persist to file (fire and forget)
      this.persist();
    }
    return deleted;
  }

  // ============================================================================
  // Participant Operations
  // ============================================================================

  async addParticipant(
    eventId: string,
    data: Omit<Participant, 'id' | 'createdAt' | 'location' | 'color'>
  ): Promise<Participant | undefined> {
    const event = this.events.get(eventId);
    if (!event) return undefined;

    // Geocode address using Google Maps API or mock
    const geocodeResult = await geocodeAddress(data.address);

    // Apply fuzzy location offset if requested
    let location = geocodeResult.location;
    if (data.fuzzyLocation) {
      const offset = 0.05; // ~5km offset for fuzzy location
      location = {
        lat: location.lat + (Math.random() - 0.5) * offset,
        lng: location.lng + (Math.random() - 0.5) * offset,
      };
    }

    const newParticipant: Participant = {
      ...data,
      id: `prt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location,
      color: this.getRandomColor(),
      createdAt: new Date().toISOString(),
    };

    event.participants.push(newParticipant);
    this.events.set(eventId, event);
    console.log('[MockStore] Participant added:', newParticipant.id);
    // Persist to file (fire and forget)
    this.persist();
    return newParticipant;
  }

  async updateParticipant(
    eventId: string,
    participantId: string,
    updates: Partial<Participant>
  ): Promise<Participant | undefined> {
    const event = this.events.get(eventId);
    if (!event) return undefined;

    const participantIndex = event.participants.findIndex((p) => p.id === participantId);
    if (participantIndex === -1) return undefined;

    // If address changed, re-geocode
    if (updates.address) {
      const fuzzy =
        updates.fuzzyLocation !== undefined
          ? updates.fuzzyLocation
          : event.participants[participantIndex].fuzzyLocation;

      const geocodeResult = await geocodeAddress(updates.address);
      let location = geocodeResult.location;

      if (fuzzy) {
        const offset = 0.05;
        location = {
          lat: location.lat + (Math.random() - 0.5) * offset,
          lng: location.lng + (Math.random() - 0.5) * offset,
        };
      }

      updates.location = location;
    }

    const updatedParticipant = {
      ...event.participants[participantIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    event.participants[participantIndex] = updatedParticipant;
    this.events.set(eventId, event);
    console.log('[MockStore] Participant updated:', participantId);
    // Persist to file (fire and forget)
    this.persist();
    return updatedParticipant;
  }

  removeParticipant(eventId: string, participantId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const initialLength = event.participants.length;
    event.participants = event.participants.filter((p) => p.id !== participantId);

    if (event.participants.length < initialLength) {
      this.events.set(eventId, event);
      console.log('[MockStore] Participant removed:', participantId);
      // Persist to file (fire and forget)
      this.persist();
      return true;
    }
    return false;
  }

  // ============================================================================
  // Venue Operations
  // ============================================================================

  searchVenues(center: Location, radius: number, categories?: string[]): LegacyVenue[] {
    let results = Array.from(this.venues.values());

    // Filter by category
    if (categories && categories.length > 0) {
      results = results.filter((v) => categories.includes(v.category));
    }

    // Filter by distance from center
    results = results.filter((venue) => {
      const distance = calculateDistance(center, venue.location);
      return distance <= radius;
    });

    // Sort by rating
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    console.log(`[MockStore] Venue search: found ${results.length} venues within ${radius}m`);
    return results;
  }

  getVenue(id: string): LegacyVenue | undefined {
    return this.venues.get(id);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get random color for participant avatar
   */
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

  /**
   * Reset store to initial state (useful for testing)
   */
  reset() {
    this.events.clear();
    this.venues.clear();
    this.seedInitialData();
    console.log('[MockStore] Store reset');
    // Persist cleared state
    this.persist();
  }

  /**
   * Get all events (for debugging)
   */
  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }

  /**
   * Get all venues (for debugging)
   */
  getAllVenues(): LegacyVenue[] {
    return Array.from(this.venues.values());
  }
}

// Export singleton instance
export const mockStore = new MockDataStore();
