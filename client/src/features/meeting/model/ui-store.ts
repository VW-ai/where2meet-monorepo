import { create } from 'zustand';

export type ActiveView = 'participant' | 'venue';
export type CategoryFilter = 'bar' | 'gym' | 'cafe' | 'things_to_do' | null;

interface UIStore {
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
