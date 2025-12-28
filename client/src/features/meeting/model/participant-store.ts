/**
 * Participant Store
 *
 * Manages participant-related state for the current event
 * - Participant list (indexed by ID)
 * - Participant CRUD operations
 * - Selected participant for UI
 *
 * NOTE: This is separate from auth-store's participant tokens
 * This manages the event's participant list, while auth-store manages
 * the current user's participant identity/tokens for this event
 */

import { create } from 'zustand';
import { Participant } from '@/entities';

interface ParticipantState {
  // Participant data (indexed by participant ID)
  participantsById: Record<string, Participant>;
  participantIds: string[]; // Ordered list for display

  // UI state
  selectedParticipantId: string | null;

  // Actions
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
  setParticipants: (participants: Participant[]) => void;
  setSelectedParticipantId: (id: string | null) => void;
  reset: () => void;

  // Selectors
  getAllParticipants: () => Participant[];
  getParticipantById: (id: string) => Participant | null;
}

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  // Initial state
  participantsById: {},
  participantIds: [],
  selectedParticipantId: null,

  // Add a participant
  addParticipant: (participant) => {
    set((state) => {
      // Don't add if already exists
      if (state.participantsById[participant.id]) {
        return state;
      }

      return {
        participantsById: {
          ...state.participantsById,
          [participant.id]: participant,
        },
        participantIds: [...state.participantIds, participant.id],
      };
    });
  },

  // Update a participant
  updateParticipant: (id, updates) => {
    set((state) => {
      const existing = state.participantsById[id];
      if (!existing) return state;

      return {
        participantsById: {
          ...state.participantsById,
          [id]: { ...existing, ...updates },
        },
      };
    });
  },

  // Remove a participant
  removeParticipant: (id) => {
    set((state) => {
      const { [id]: removed, ...remaining } = state.participantsById;

      return {
        participantsById: remaining,
        participantIds: state.participantIds.filter((pid) => pid !== id),
        // Clear selection if removed participant was selected
        selectedParticipantId: state.selectedParticipantId === id ? null : state.selectedParticipantId,
      };
    });
  },

  // Set all participants (used when loading event or reconciling from SSE)
  setParticipants: (participants) => {
    const participantsById: Record<string, Participant> = {};
    const participantIds: string[] = [];

    for (const participant of participants) {
      participantsById[participant.id] = participant;
      participantIds.push(participant.id);
    }

    set({ participantsById, participantIds });
  },

  // Set selected participant ID for UI
  setSelectedParticipantId: (id) => {
    set({ selectedParticipantId: id });
  },

  // Reset store (clear all participants)
  reset: () => {
    set({
      participantsById: {},
      participantIds: [],
      selectedParticipantId: null,
    });
  },

  // Selectors

  // Get all participants as array (ordered by participantIds)
  getAllParticipants: () => {
    const { participantsById, participantIds } = get();
    return participantIds.map((id) => participantsById[id]).filter(Boolean);
  },

  // Get participant by ID
  getParticipantById: (id) => {
    return get().participantsById[id] || null;
  },
}));
