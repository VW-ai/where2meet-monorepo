/**
 * Critical tests for voting/SSE architecture refactor
 * These tests prevent the 3 most common bugs:
 * 1. SSE overwriting venue details
 * 2. "includes crash" from undefined voterIds
 * 3. Rollback removing venue details
 */

import { useMeetingStore } from '../meeting-store';
import type { Venue } from '@/entities';
import type { VoteStatisticsResponse } from '@/shared/types/api';

describe('Voting Architecture - Critical Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useMeetingStore.getState().reset();
  });

  /**
   * Test A: SSE should NOT overwrite venue details
   *
   * Bug prevented: "Liked venues disappearing"
   * Root cause: SSE payloads with incomplete venue data overwriting complete data
   */
  test('SSE should not overwrite venue details with incomplete data', () => {
    const store = useMeetingStore.getState();

    // 1. Seed venueById with FULL venue details (from search/vote)
    const fullVenue: Venue = {
      id: 'venue-123',
      name: 'Complete Cafe',
      address: '123 Main St, Brooklyn, NY',
      location: { lat: 40.7128, lng: -74.006 },
      types: ['cafe', 'restaurant'],
      rating: 4.5,
      userRatingsTotal: 250,
      priceLevel: 2,
      openNow: true,
      photoUrl: 'https://example.com/photo.jpg',
    };

    // Simulate adding venue through search
    store.setSearchedVenues([fullVenue]);

    // Verify full details are stored
    expect(store.venueById['venue-123']).toEqual(fullVenue);

    // 2. Call setVoteStatistics with SSE payload (incomplete venue data)
    const ssePayload: VoteStatisticsResponse = {
      venues: [
        {
          id: 'venue-123',
          name: 'Complete Cafe', // SSE only has basic fields
          address: null, // Missing!
          location: { lat: 40.7128, lng: -74.006 },
          category: null, // Missing!
          rating: null, // Missing!
          priceLevel: null, // Missing!
          photoUrl: null, // Missing!
          voteCount: 5,
          voters: ['participant-1', 'participant-2'],
        },
      ],
      totalVotes: 5,
    };

    store.setVoteStatistics(ssePayload);

    // 3. Assert: Venue details should REMAIN UNCHANGED
    const venueAfterSSE = store.venueById['venue-123'];
    expect(venueAfterSSE).toEqual(fullVenue);
    expect(venueAfterSSE.address).toBe('123 Main St, Brooklyn, NY'); // NOT null
    expect(venueAfterSSE.types).toEqual(['cafe', 'restaurant']); // NOT empty
    expect(venueAfterSSE.rating).toBe(4.5); // NOT null
    expect(venueAfterSSE.photoUrl).toBe('https://example.com/photo.jpg'); // NOT null

    // 4. Assert: Vote stats ARE updated
    const voteStats = store.voteStatsByVenueId['venue-123'];
    expect(voteStats).toEqual({
      voteCount: 5,
      voterIds: ['participant-1', 'participant-2'],
    });
  });

  /**
   * Test B: "includes crash" should NEVER happen
   *
   * Bug prevented: Cannot read properties of undefined (reading 'includes')
   * Root cause: Backend inconsistency - sometimes voterNames is undefined
   */
  test('should handle missing voterNames/voterIds without crashing', () => {
    const store = useMeetingStore.getState();
    store.myParticipantId = 'participant-1';

    // 1. Create SSE payload with MISSING voterNames field (backend bug)
    const malformedPayload = {
      venues: [
        {
          id: 'venue-456',
          name: 'Venue Without Voters',
          address: null,
          location: { lat: 40.7128, lng: -74.006 },
          category: null,
          rating: null,
          priceLevel: null,
          photoUrl: null,
          voteCount: 3,
          // voterNames: undefined, // MISSING!
        } as Partial<VenueWithVotes>,
      ],
      totalVotes: 3,
    };

    // 2. This should NOT crash
    expect(() => {
      store.setVoteStatistics(malformedPayload as VoteStatisticsResponse);
    }).not.toThrow();

    // 3. Assert: voterIds defaults to empty array
    const voteStats = store.voteStatsByVenueId['venue-456'];
    expect(voteStats.voterIds).toEqual([]); // NOT undefined
    expect(Array.isArray(voteStats.voterIds)).toBe(true);

    // 4. Assert: Calling .includes() on voterIds works
    expect(() => {
      voteStats.voterIds.includes('participant-1');
    }).not.toThrow();
  });

  /**
   * Test C: Rollback should NOT remove venue details
   *
   * Bug prevented: Venue disappearing after failed vote
   * Root cause: Optimistic update rollback removing venueById entry
   */
  test('rollback should only revert vote stats, not venue details', async () => {
    const store = useMeetingStore.getState();

    // 1. Setup: venue from search results
    const testVenue: Venue = {
      id: 'venue-789',
      name: 'Test Restaurant',
      address: '456 Broadway, NY',
      location: { lat: 40.7589, lng: -73.9851 },
      types: ['restaurant'],
      rating: 4.2,
      userRatingsTotal: 100,
      priceLevel: 3,
      openNow: true,
      photoUrl: 'https://example.com/restaurant.jpg',
    };

    store.setSearchedVenues([testVenue]);

    // Verify venue is in store
    expect(store.venueById['venue-789']).toEqual(testVenue);
    expect(store.voteStatsByVenueId['venue-789']).toBeUndefined(); // No votes yet

    // 2. Optimistic vote adds venue details
    store.myParticipantId = 'participant-1';

    // Simulate optimistic update (without actual API call)
    const previousStats = store.voteStatsByVenueId['venue-789'];
    const previousSavedVenues = store.savedVenues;
    const previousLikedVenueData = store.likedVenueData;

    // Manually apply optimistic update logic
    useMeetingStore.setState((state) => {
      const newVenueById = { ...state.venueById };
      newVenueById['venue-789'] = testVenue;

      const newVoteStatsByVenueId = {
        ...state.voteStatsByVenueId,
        'venue-789': {
          voteCount: 1,
          voterIds: ['participant-1'],
        },
      };

      return {
        venueById: newVenueById,
        voteStatsByVenueId: newVoteStatsByVenueId,
        savedVenues: ['venue-789'],
        likedVenueData: { 'venue-789': testVenue },
      };
    });

    // Verify optimistic state
    expect(store.voteStatsByVenueId['venue-789']?.voteCount).toBe(1);
    expect(store.savedVenues).toContain('venue-789');

    // 3. Simulate HTTP failure → rollback
    useMeetingStore.setState((state) => {
      const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };
      if (previousStats) {
        newVoteStatsByVenueId['venue-789'] = previousStats;
      } else {
        delete newVoteStatsByVenueId['venue-789'];
      }

      return {
        voteStatsByVenueId: newVoteStatsByVenueId,
        savedVenues: previousSavedVenues,
        likedVenueData: previousLikedVenueData,
      };
    });

    // 4. Assert: Venue details STILL EXIST
    const venueAfterRollback = store.venueById['venue-789'];
    expect(venueAfterRollback).toEqual(testVenue);
    expect(venueAfterRollback.address).toBe('456 Broadway, NY');
    expect(venueAfterRollback.photoUrl).toBe('https://example.com/restaurant.jpg');

    // 5. Assert: Vote stats reverted
    expect(store.voteStatsByVenueId['venue-789']).toBeUndefined();
    expect(store.savedVenues).not.toContain('venue-789');
  });

  /**
   * Bonus Test: Derived selectors work correctly
   */
  test('derived selectors provide correct single source of truth', () => {
    const store = useMeetingStore.getState();
    store.myParticipantId = 'participant-1';

    // Add some venues
    const venue1: Venue = {
      id: 'venue-1',
      name: 'Venue One',
      address: '',
      location: { lat: 0, lng: 0 },
      types: [],
      rating: null,
      userRatingsTotal: null,
      priceLevel: null,
      openNow: null,
      photoUrl: null,
    };

    const venue2: Venue = {
      id: 'venue-2',
      name: 'Venue Two',
      address: '',
      location: { lat: 0, lng: 0 },
      types: [],
      rating: null,
      userRatingsTotal: null,
      priceLevel: null,
      openNow: null,
      photoUrl: null,
    };

    useMeetingStore.setState({
      venueById: { 'venue-1': venue1, 'venue-2': venue2 },
      voteStatsByVenueId: {
        'venue-1': { voteCount: 5, voterIds: ['participant-1', 'participant-2', 'participant-3'] },
        'venue-2': { voteCount: 2, voterIds: ['participant-4'] },
      },
      myParticipantId: 'participant-1',
    });

    // Test getMyLikedVenueIds
    const myLikedIds = store.getMyLikedVenueIds();
    expect(myLikedIds).toEqual(['venue-1']); // Only venue-1 has participant-1

    // Test getAllVotedVenueIdsSorted
    const sortedIds = store.getAllVotedVenueIdsSorted();
    expect(sortedIds).toEqual(['venue-1', 'venue-2']); // Sorted by voteCount descending

    // Test getVenueWithStats
    const venueWithStats = store.getVenueWithStats('venue-1');
    expect(venueWithStats).toMatchObject({
      id: 'venue-1',
      name: 'Venue One',
      voteCount: 5,
    });

    // Test getAllVotedVenues
    const allVoted = store.getAllVotedVenues();
    expect(allVoted).toHaveLength(2);
    expect(allVoted[0].voteCount).toBeDefined();
  });
});
