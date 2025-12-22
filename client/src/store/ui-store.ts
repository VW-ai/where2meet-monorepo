import { create } from 'zustand';

export type ActiveView = 'participant' | 'venue';
export type CategoryFilter = 'bar' | 'gym' | 'cafe' | 'things_to_do' | null;
export type TravelMode = 'car' | 'transit' | 'walk' | 'bike';

interface UIStore {
  // Organizer mode (controls visibility of edit/add features)
  // Determined automatically by checking localStorage for organizer token
  isOrganizerMode: boolean;
  organizerToken: string | null; // Token for current event (from localStorage)
  organizerParticipantId: string | null; // Organizer's participant ID (for voting)
  initializeOrganizerMode: (eventId: string) => void; // Check localStorage for token
  setOrganizerInfo: (eventId: string, token: string, participantId: string) => void; // Store both token and participantId
  clearOrganizerToken: () => void; // Clear on 401/403

  // Participant mode (current user is a registered participant)
  // Determined automatically by checking localStorage for participant token
  isParticipantMode: boolean;
  participantToken: string | null; // Token for self-management
  currentParticipantId: string | null; // ID of current user's participant record
  initializeParticipantMode: (eventId: string) => void; // Check localStorage for token
  setParticipantInfo: (eventId: string, participantId: string, token: string) => void; // Store after registration
  clearParticipantInfo: (eventId: string) => void; // Clear on leave/401/403

  // Active view (participant vs venue section)
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Sidebar visibility
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
  showSidebar: () => void;
  hideSidebar: () => void;

  // Category filter
  selectedCategory: CategoryFilter;
  setSelectedCategory: (category: CategoryFilter) => void;

  // Travel mode filter
  selectedTravelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;

  // Search query (for communication between header filters and search bar)
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Executed search query (persisted for venue results display)
  executedSearchQuery: string;
  setExecutedSearchQuery: (query: string) => void;

  // Search execution trigger (for category filters to trigger venue search)
  searchExecutionTrigger: number;
  triggerSearchExecution: () => void;

  // Participant icon flash animation trigger
  shouldFlashParticipantIcon: boolean;
  triggerParticipantFlash: () => void;
  resetParticipantFlash: () => void;

  // Modals
  isShareModalOpen: boolean;
  isEditEventModalOpen: boolean;
  isDeleteConfirmationOpen: boolean;
  isPublishModalOpen: boolean;

  openShareModal: () => void;
  closeShareModal: () => void;

  openEditEventModal: () => void;
  closeEditEventModal: () => void;

  openDeleteConfirmation: () => void;
  closeDeleteConfirmation: () => void;

  openPublishModal: () => void;
  closePublishModal: () => void;

  // Analysis slide-out
  isAnalysisOpen: boolean;
  toggleAnalysis: () => void;
  closeAnalysis: () => void;

  // Venue info slide-out
  isVenueInfoOpen: boolean;
  selectedVenueId: string | null;
  openVenueInfo: (venueId: string) => void;
  closeVenueInfo: () => void;

  // Participant stats slide-out
  isParticipantStatsOpen: boolean;
  toggleParticipantStats: () => void;
  closeParticipantStats: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Organizer mode (default to false until token is checked)
  isOrganizerMode: false,
  organizerToken: null,
  organizerParticipantId: null,
  initializeOrganizerMode: (eventId: string) => {
    // Check localStorage for organizer token and participant ID
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(`organizer_token_${eventId}`);
    const participantId = localStorage.getItem(`organizer_participant_id_${eventId}`);
    if (token && participantId) {
      set({ isOrganizerMode: true, organizerToken: token, organizerParticipantId: participantId });
    } else {
      set({ isOrganizerMode: false, organizerToken: null, organizerParticipantId: null });
    }
  },
  setOrganizerInfo: (eventId: string, token: string, participantId: string) => {
    // Store in localStorage and update state
    if (typeof window !== 'undefined') {
      localStorage.setItem(`organizer_token_${eventId}`, token);
      localStorage.setItem(`organizer_participant_id_${eventId}`, participantId);
    }
    set({ isOrganizerMode: true, organizerToken: token, organizerParticipantId: participantId });
  },
  clearOrganizerToken: () => {
    set({ isOrganizerMode: false, organizerToken: null, organizerParticipantId: null });
  },

  // Participant mode (default to false until token is checked)
  isParticipantMode: false,
  participantToken: null,
  currentParticipantId: null,
  initializeParticipantMode: (eventId: string) => {
    // Check localStorage for participant token
    if (typeof window === 'undefined') return;
    const participantId = localStorage.getItem(`participant_id_${eventId}`);
    const token = localStorage.getItem(`participant_token_${eventId}`);
    if (participantId && token) {
      set({
        isParticipantMode: true,
        participantToken: token,
        currentParticipantId: participantId,
      });
    } else {
      set({ isParticipantMode: false, participantToken: null, currentParticipantId: null });
    }
  },
  setParticipantInfo: (eventId: string, participantId: string, token: string) => {
    // Store in localStorage and update state
    if (typeof window !== 'undefined') {
      localStorage.setItem(`participant_id_${eventId}`, participantId);
      localStorage.setItem(`participant_token_${eventId}`, token);
    }
    set({ isParticipantMode: true, participantToken: token, currentParticipantId: participantId });
  },
  clearParticipantInfo: (eventId: string) => {
    // Remove from localStorage and update state
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`participant_id_${eventId}`);
      localStorage.removeItem(`participant_token_${eventId}`);
    }
    set({ isParticipantMode: false, participantToken: null, currentParticipantId: null });
  },

  // View state
  activeView: 'participant',
  setActiveView: (view) => set({ activeView: view }),

  // Sidebar visibility
  isSidebarVisible: true,
  toggleSidebar: () => set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),
  showSidebar: () => set({ isSidebarVisible: true }),
  hideSidebar: () => set({ isSidebarVisible: false }),

  // Filter state
  selectedCategory: null,
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  // Travel mode (default to car)
  selectedTravelMode: 'car',
  setTravelMode: (mode) => {
    set({ selectedTravelMode: mode, shouldFlashParticipantIcon: true });
  },

  // Search query
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Executed search query (persisted)
  executedSearchQuery: '',
  setExecutedSearchQuery: (query) => set({ executedSearchQuery: query }),

  // Search execution trigger (timestamp-based trigger for category filters)
  searchExecutionTrigger: 0,
  triggerSearchExecution: () =>
    set((state) => ({
      searchExecutionTrigger: state.searchExecutionTrigger + 1,
    })),

  // Participant icon flash
  shouldFlashParticipantIcon: false,
  triggerParticipantFlash: () => set({ shouldFlashParticipantIcon: true }),
  resetParticipantFlash: () => set({ shouldFlashParticipantIcon: false }),

  // Modals
  isShareModalOpen: false,
  isEditEventModalOpen: false,
  isDeleteConfirmationOpen: false,
  isPublishModalOpen: false,

  openShareModal: () => set({ isShareModalOpen: true }),
  closeShareModal: () => set({ isShareModalOpen: false }),

  openEditEventModal: () => set({ isEditEventModalOpen: true }),
  closeEditEventModal: () => set({ isEditEventModalOpen: false }),

  openDeleteConfirmation: () => set({ isDeleteConfirmationOpen: true }),
  closeDeleteConfirmation: () => set({ isDeleteConfirmationOpen: false }),

  openPublishModal: () => set({ isPublishModalOpen: true }),
  closePublishModal: () => set({ isPublishModalOpen: false }),

  // Analysis
  isAnalysisOpen: false,
  toggleAnalysis: () => set((state) => ({ isAnalysisOpen: !state.isAnalysisOpen })),
  closeAnalysis: () => set({ isAnalysisOpen: false }),

  // Venue info
  isVenueInfoOpen: false,
  selectedVenueId: null,
  openVenueInfo: (venueId) => set({ isVenueInfoOpen: true, selectedVenueId: venueId }),
  closeVenueInfo: () => set({ isVenueInfoOpen: false, selectedVenueId: null }),

  // Participant stats
  isParticipantStatsOpen: false,
  toggleParticipantStats: () =>
    set((state) => ({ isParticipantStatsOpen: !state.isParticipantStatsOpen })),
  closeParticipantStats: () => set({ isParticipantStatsOpen: false }),
}));
