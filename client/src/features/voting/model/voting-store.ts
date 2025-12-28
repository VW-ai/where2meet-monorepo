/**
 * Voting Store
 *
 * Manages vote-related state ONLY (not venue data)
 * - Vote statistics (counts, voter IDs)
 * - User's voted venue IDs
 * - Vote actions (cast, remove, load statistics)
 *
 * NOTE: Venue data (names, locations, etc.) stays in meeting-store
 */

import { create } from 'zustand';
import { VoteStatisticsResponse, CastVoteRequest } from '@/shared/types/api';
import { votingClient } from '@/features/voting/api';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';

interface VotingState {
  // Vote statistics from backend (indexed by venue ID)
  voteStatsByVenueId: Record<
    string,
    {
      voteCount: number;
      voterIds: string[]; // Participant IDs who voted for this venue
      seq?: number; // Optional sequence number for SSE
    }
  >;

  // Full vote statistics response (for compatibility)
  voteStatistics: VoteStatisticsResponse | null;

  // Loading state
  isLoadingVotes: boolean;

  // Participant ID for voting (organizer or participant)
  myParticipantId: string | null;

  // Actions
  setMyParticipantId: (participantId: string | null) => void;
  voteForVenue: (
    eventId: string,
    venueId: string,
    venueData: CastVoteRequest['venueData']
  ) => Promise<void>;
  unvoteForVenue: (eventId: string, venueId: string) => Promise<void>;
  loadVoteStatistics: (eventId: string) => Promise<void>;
  setVoteStatistics: (statistics: VoteStatisticsResponse) => void;

  // Selectors
  getAllVotedVenueIds: () => string[];
  getMyLikedVenueIds: () => string[];
  getVoteCountForVenue: (venueId: string) => number;
  hasVotedFor: (venueId: string) => boolean;
}

export const useVotingStore = create<VotingState>((set, get) => ({
  // Initial state
  voteStatsByVenueId: {},
  voteStatistics: null,
  isLoadingVotes: false,
  myParticipantId: null,

  // Set participant ID for voting
  setMyParticipantId: (participantId) => {
    set({ myParticipantId: participantId });
  },

  // Cast a vote for a venue
  voteForVenue: async (eventId, venueId, venueData) => {
    // Get tokens and participant ID from auth store
    const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
      useAuthStore.getState();
    const { myParticipantId } = get();

    // Determine which participant ID to use (organizer's ID takes precedence)
    const participantId = organizerParticipantId || currentParticipantId || myParticipantId;
    const token = organizerToken || participantToken;

    if (!participantId || !token) {
      console.error('Cannot vote: Missing required data');
      console.error('  - participantId:', participantId ? 'OK' : 'MISSING');
      console.error('  - token:', token ? 'OK' : 'MISSING');
      return;
    }

    // Save previous stats for rollback
    const previousStats = get().voteStatsByVenueId[venueId];

    try {
      // Optimistic update (vote stats + ensure venue data is in venueById)
      set((state) => {
        const currentStats = state.voteStatsByVenueId[venueId] || { voteCount: 0, voterIds: [] };
        const newVoterIds = currentStats.voterIds.includes(participantId)
          ? currentStats.voterIds
          : [...currentStats.voterIds, participantId];

        const newVoteStatsByVenueId = {
          ...state.voteStatsByVenueId,
          [venueId]: {
            voteCount: newVoterIds.length,
            voterIds: newVoterIds,
          },
        };

        return {
          voteStatsByVenueId: newVoteStatsByVenueId,
        };
      });

      // Also ensure venue data is in meeting store's venueById
      const { venueById } = useMeetingStore.getState();
      if (!venueById[venueId]) {
        // Convert venueData to Venue format and add to venueById
        useMeetingStore.setState((state) => ({
          venueById: {
            ...state.venueById,
            [venueId]: {
              id: venueId,
              name: venueData.name,
              address: venueData.address || '',
              location: { lat: venueData.lat, lng: venueData.lng },
              types: venueData.category ? [venueData.category] : [],
              rating: venueData.rating ?? null,
              userRatingsTotal: null,
              priceLevel: venueData.priceLevel ?? null,
              openNow: null,
              photoUrl: venueData.photoUrl ?? null,
            },
          },
        }));
      }

      // Call backend API with venue data
      await votingClient.castVote(eventId, participantId, { venueId, venueData }, token);

      // Load fresh statistics from backend to reconcile
      await get().loadVoteStatistics(eventId);
    } catch (error) {
      console.error('Failed to vote:', error);

      // Rollback on error
      set((state) => {
        const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };
        if (previousStats) {
          newVoteStatsByVenueId[venueId] = previousStats;
        } else {
          delete newVoteStatsByVenueId[venueId];
        }

        return {
          voteStatsByVenueId: newVoteStatsByVenueId,
        };
      });

      throw error;
    }
  },

  // Remove a vote for a venue
  unvoteForVenue: async (eventId, venueId) => {
    // Get tokens and participant ID from auth store
    const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
      useAuthStore.getState();
    const { myParticipantId } = get();

    // Determine which participant ID to use (organizer's ID takes precedence)
    const participantId = organizerParticipantId || currentParticipantId || myParticipantId;
    const token = organizerToken || participantToken;

    if (!participantId || !token) {
      console.error('Cannot unvote: Missing required data');
      return;
    }

    // Save previous stats for rollback
    const previousStats = get().voteStatsByVenueId[venueId];

    try {
      // Optimistic update
      set((state) => {
        const currentStats = state.voteStatsByVenueId[venueId];
        if (!currentStats) return state;

        const newVoterIds = currentStats.voterIds.filter((id) => id !== participantId);
        const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };

        if (newVoterIds.length === 0) {
          // No more votes, remove stats entry
          delete newVoteStatsByVenueId[venueId];
        } else {
          newVoteStatsByVenueId[venueId] = {
            voteCount: newVoterIds.length,
            voterIds: newVoterIds,
          };
        }

        return {
          voteStatsByVenueId: newVoteStatsByVenueId,
        };
      });

      // Call backend API
      await votingClient.removeVote(eventId, participantId, venueId, token);

      // Load fresh statistics from backend to reconcile
      await get().loadVoteStatistics(eventId);
    } catch (error) {
      console.error('Failed to remove vote:', error);

      // Rollback on error
      set((state) => {
        const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };
        if (previousStats) {
          newVoteStatsByVenueId[venueId] = previousStats;
        } else {
          delete newVoteStatsByVenueId[venueId];
        }

        return {
          voteStatsByVenueId: newVoteStatsByVenueId,
        };
      });

      throw error;
    }
  },

  // Load vote statistics from backend
  loadVoteStatistics: async (eventId) => {
    if (!eventId) {
      console.error('Cannot load vote statistics: No event ID provided');
      return;
    }

    set({ isLoadingVotes: true });

    try {
      const statistics = await votingClient.getStatistics(eventId);

      const newVoteStatsByVenueId: Record<
        string,
        { voteCount: number; voterIds: string[]; seq?: number }
      > = {};

      // Process vote statistics
      for (const venueStats of statistics.venues) {
        // Update vote stats (snapshot is source of truth)
        newVoteStatsByVenueId[venueStats.id] = {
          voteCount: venueStats.voteCount,
          voterIds: venueStats.voters || [],
        };
      }

      // Set vote statistics immediately (don't block on hydration)
      set({
        voteStatsByVenueId: newVoteStatsByVenueId,
        voteStatistics: statistics,
      });

      // Hydrate missing venue details asynchronously (non-blocking)
      const { venueById, hydrateVenue } = useMeetingStore.getState();

      // Deduplicate venue IDs (using Set)
      const missingVenueIds = Array.from(
        new Set(statistics.venues.map((v) => v.id).filter((venueId) => !venueById[venueId]))
      );

      if (missingVenueIds.length > 0) {
        console.log('[VotingStore] Hydrating missing venues:', missingVenueIds);

        // Run hydration asynchronously (don't await - let it run in background)
        (async () => {
          const CONCURRENCY_LIMIT = 3;
          for (let i = 0; i < missingVenueIds.length; i += CONCURRENCY_LIMIT) {
            const batch = missingVenueIds.slice(i, i + CONCURRENCY_LIMIT);
            // Use allSettled for resilience (though hydrateVenue already swallows errors)
            await Promise.allSettled(batch.map((venueId) => hydrateVenue(venueId)));
          }
        })();
      }
    } catch (error) {
      console.error('Failed to load vote statistics:', error);
    } finally {
      set({ isLoadingVotes: false });
    }
  },

  // Set vote statistics (called from SSE handlers)
  setVoteStatistics: (statistics) => {
    console.warn('[VotingStore] setVoteStatistics called with:', {
      venuesCount: statistics.venues.length,
      totalVotes: statistics.totalVotes,
    });

    const newVoteStatsByVenueId: Record<
      string,
      { voteCount: number; voterIds: string[]; seq?: number }
    > = {};

    // Process vote statistics
    for (const venueStats of statistics.venues) {
      const voterIds = venueStats.voters || [];

      // Always update vote stats (this is what SSE is for)
      newVoteStatsByVenueId[venueStats.id] = {
        voteCount: venueStats.voteCount,
        voterIds,
      };
    }

    // Debug logging
    console.warn('[VotingStore] Updated vote data:', {
      voteStatsCount: Object.keys(newVoteStatsByVenueId).length,
    });

    set({
      voteStatsByVenueId: newVoteStatsByVenueId,
      voteStatistics: statistics,
    });
  },

  // Selectors

  // Get ALL venue IDs that have votes (from any participant)
  getAllVotedVenueIds: () => {
    const { voteStatsByVenueId } = get();
    return Object.keys(voteStatsByVenueId);
  },

  // Get venue IDs that the current user voted for
  getMyLikedVenueIds: () => {
    const { voteStatsByVenueId, myParticipantId } = get();

    // Get participant ID from auth store if not set locally
    const { organizerParticipantId, currentParticipantId } = useAuthStore.getState();
    const participantId = myParticipantId || organizerParticipantId || currentParticipantId;

    if (!participantId) return [];

    return Object.entries(voteStatsByVenueId)
      .filter(([_, stats]) => stats.voterIds.includes(participantId))
      .map(([venueId]) => venueId);
  },

  // Get vote count for a specific venue
  getVoteCountForVenue: (venueId) => {
    const { voteStatsByVenueId } = get();
    return voteStatsByVenueId[venueId]?.voteCount ?? 0;
  },

  // Check if current user has voted for a venue
  hasVotedFor: (venueId) => {
    const { voteStatsByVenueId, myParticipantId } = get();

    // Get participant ID from auth store if not set locally
    const { organizerParticipantId, currentParticipantId } = useAuthStore.getState();
    const participantId = myParticipantId || organizerParticipantId || currentParticipantId;

    if (!participantId) return false;

    const stats = voteStatsByVenueId[venueId];
    return stats ? stats.voterIds.includes(participantId) : false;
  },
}));
