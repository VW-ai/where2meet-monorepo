import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TutorialState {
  // Persisted state - tracks if user has seen the tutorial
  hasSeenOrganizerTutorial: boolean;

  // Ephemeral state - current tutorial session
  isTutorialActive: boolean;
  currentStep: number; // 0-2 for 3 steps

  // Actions
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  markTutorialComplete: () => void;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      // Persisted state
      hasSeenOrganizerTutorial: false,

      // Ephemeral state (not persisted)
      isTutorialActive: false,
      currentStep: 0,

      // Start tutorial from step 0
      startTutorial: () => {
        set({
          isTutorialActive: true,
          currentStep: 0,
        });
      },

      // Move to next step
      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < 3) {
          set({ currentStep: currentStep + 1 });
        }
      },

      // Move to previous step
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      // Skip tutorial (mark as seen even if not completed)
      skipTutorial: () => {
        set({
          isTutorialActive: false,
          hasSeenOrganizerTutorial: true,
          currentStep: 0,
        });
      },

      // Complete tutorial successfully
      markTutorialComplete: () => {
        set({
          isTutorialActive: false,
          hasSeenOrganizerTutorial: true,
          currentStep: 0,
        });
      },
    }),
    {
      name: 'tutorial-storage',
      // Only persist the "seen" flag, not the session state
      partialize: (state) => ({
        hasSeenOrganizerTutorial: state.hasSeenOrganizerTutorial,
      }),
    }
  )
);

// Development helper to reset tutorial
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as typeof window & { __resetTutorial?: () => void }).__resetTutorial = () => {
    localStorage.removeItem('tutorial-storage');
    window.location.reload();
  };
}
