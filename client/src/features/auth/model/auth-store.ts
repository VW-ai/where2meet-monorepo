import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, RegisterDTO, UpdateUserDTO } from '@/features/auth/types';
import { authClient } from '@/features/auth/api';
import { userClient } from '@/features/user/api';
import { scanLocalStorageForTokens, claimAllTokens } from '@/lib/utils/token-claimer';

interface AuthState {
  // User authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Event access tokens (organizer mode)
  isOrganizerMode: boolean;
  organizerToken: string | null;
  organizerParticipantId: string | null;

  // Event access tokens (participant mode)
  isParticipantMode: boolean;
  participantToken: string | null;
  currentParticipantId: string | null;

  // Auth initialization state (prevents hydration flash)
  isAuthInitialized: boolean;

  // User authentication actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  register: (data: RegisterDTO) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>; // Called on app load
  updateProfile: (data: UpdateUserDTO) => Promise<void>;
  clearError: () => void;

  // Event token actions
  initializeOrganizerMode: (eventId: string) => void;
  setOrganizerInfo: (eventId: string, token: string, participantId: string) => void;
  clearOrganizerToken: () => void;
  initializeParticipantMode: (eventId: string) => void;
  setParticipantInfo: (eventId: string, participantId: string, token: string) => void;
  clearParticipantInfo: (eventId: string) => void;
}

type SetAuthState = (partial: Partial<AuthState>) => void;

/**
 * Runs a request that returns the signed-in user (the backend sets the session
 * cookie), then claims any event tokens this browser holds in the background.
 */
async function signIn(set: SetAuthState, request: () => Promise<{ user: User }>): Promise<void> {
  try {
    set({ isLoading: true, error: null });
    const { user } = await request();
    set({ user, isAuthenticated: true });

    if (typeof window !== 'undefined') {
      const tokens = scanLocalStorageForTokens();
      if (tokens.length > 0) {
        claimAllTokens(tokens)
          .then((result) => {
            console.warn(`Auto-claimed ${result.claimed} events`);
            if (result.failed > 0) {
              console.warn('Some claims failed:', result.errors);
            }
          })
          .catch((err) => console.error('Auto-claim error:', err));
      }
    }
  } catch (error) {
    set({ error: error instanceof Error ? error.message : 'Operation failed' });
    throw error;
  } finally {
    set({ isLoading: false });
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // User authentication state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Event access tokens (initially null)
      isOrganizerMode: false,
      organizerToken: null,
      organizerParticipantId: null,
      isParticipantMode: false,
      participantToken: null,
      currentParticipantId: null,

      // Auth initialization state
      isAuthInitialized: false,

      // Set user (internal helper)
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        }),

      register: (data) => signIn(set, () => authClient.register(data)),

      login: (email, password) => signIn(set, () => authClient.login({ email, password })),

      signInWithGoogle: (credential) => signIn(set, () => authClient.signInWithGoogle(credential)),

      // Log out
      logout: async () => {
        try {
          await authClient.logout();
          // Backend clears session cookie
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      // Check if session is valid (called once on app load)
      checkSession: async () => {
        try {
          set({ isLoading: true });
          const { user } = await authClient.getSession();
          set({ user, isAuthenticated: user !== null, isAuthInitialized: true });
        } catch (error) {
          set({ user: null, isAuthenticated: false, isAuthInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      // Update user profile
      updateProfile: async (data) => {
        const updated = await userClient.updateProfile(data);
        set({ user: updated });
      },

      // Clear error message
      clearError: () => set({ error: null }),

      // Event token management - Organizer mode
      initializeOrganizerMode: (eventId: string) => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem(`organizer_token_${eventId}`);
        const participantId = localStorage.getItem(`organizer_participant_id_${eventId}`);
        console.warn('[AuthStore] initializeOrganizerMode:', {
          eventId,
          hasToken: !!token,
          hasParticipantId: !!participantId,
          tokenPreview: token ? `${token.substring(0, 10)}...` : null,
        });
        if (token && participantId) {
          set({
            isOrganizerMode: true,
            organizerToken: token,
            organizerParticipantId: participantId,
            isAuthInitialized: true,
          });
          console.warn('[AuthStore] Set isOrganizerMode to TRUE');
        } else {
          set({
            isOrganizerMode: false,
            organizerToken: null,
            organizerParticipantId: null,
            isAuthInitialized: true,
          });
          console.warn('[AuthStore] Set isOrganizerMode to FALSE (missing credentials)');
        }
      },

      setOrganizerInfo: (eventId: string, token: string, participantId: string) => {
        console.warn('[AuthStore] setOrganizerInfo called:', {
          eventId,
          tokenLength: token.length,
          participantId,
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem(`organizer_token_${eventId}`, token);
          localStorage.setItem(`organizer_participant_id_${eventId}`, participantId);
          console.warn('[AuthStore] Stored in localStorage:', {
            tokenKey: `organizer_token_${eventId}`,
            participantIdKey: `organizer_participant_id_${eventId}`,
          });
        }
        set({
          isOrganizerMode: true,
          organizerToken: token,
          organizerParticipantId: participantId,
        });
        console.warn('[AuthStore] State updated - isOrganizerMode: true');
      },

      clearOrganizerToken: () => {
        set({ isOrganizerMode: false, organizerToken: null, organizerParticipantId: null });
      },

      // Event token management - Participant mode
      initializeParticipantMode: (eventId: string) => {
        if (typeof window === 'undefined') return;
        const participantId = localStorage.getItem(`participant_id_${eventId}`);
        const token = localStorage.getItem(`participant_token_${eventId}`);
        if (participantId && token) {
          set({
            isParticipantMode: true,
            participantToken: token,
            currentParticipantId: participantId,
            isAuthInitialized: true,
          });
        } else {
          set({
            isParticipantMode: false,
            participantToken: null,
            currentParticipantId: null,
            isAuthInitialized: true,
          });
        }
      },

      setParticipantInfo: (eventId: string, participantId: string, token: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`participant_id_${eventId}`, participantId);
          localStorage.setItem(`participant_token_${eventId}`, token);
        }
        set({
          isParticipantMode: true,
          participantToken: token,
          currentParticipantId: participantId,
        });
      },

      clearParticipantInfo: (eventId: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`participant_id_${eventId}`);
          localStorage.removeItem(`participant_token_${eventId}`);
        }
        set({ isParticipantMode: false, participantToken: null, currentParticipantId: null });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user data for UI (backend cookie is source of truth)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
