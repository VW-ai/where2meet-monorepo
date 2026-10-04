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
  confirmMeetingParticipant: (
    eventId: string,
    token: string,
    participantId: string,
    isOrganizer: boolean
  ) => boolean;
  rejectMeetingToken: (eventId: string, token: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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

      // Register new account
      register: async (data) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authClient.register(data);
          // Backend sets session cookie, returns user
          set({ user: response.user, isAuthenticated: true });

          // Auto-claim tokens in background (fire-and-forget)
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
      },

      // Log in
      login: async (email, password) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authClient.login({ email, password });
          // Backend sets session cookie, returns user
          set({ user: response.user, isAuthenticated: true });

          // Auto-claim tokens in background (fire-and-forget)
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
      },

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
          const response = await authClient.getSession();
          set({ user: response.user, isAuthenticated: true, isAuthInitialized: true });
        } catch (error) {
          // Session expired or invalid
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
        set({
          isOrganizerMode: false,
          organizerToken: token,
          organizerParticipantId: null,
          isAuthInitialized: true,
        });
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
        const token = localStorage.getItem(`participant_token_${eventId}`);
        set({
          isParticipantMode: false,
          participantToken: token,
          currentParticipantId: null,
          isAuthInitialized: true,
        });
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

      confirmMeetingParticipant: (eventId, token, participantId, isOrganizer) => {
        if (get().organizerToken !== token && get().participantToken !== token) return false;
        if (typeof window !== 'undefined') {
          const organizerKey = `organizer_token_${eventId}`;
          const participantKey = `participant_token_${eventId}`;
          const sourceIsOrganizer = localStorage.getItem(organizerKey) === token;
          const sourceKey = sourceIsOrganizer
            ? organizerKey
            : localStorage.getItem(participantKey) === token ? participantKey : null;
          if (!sourceKey) return false;
          const sourceIdKey = `${sourceIsOrganizer ? 'organizer_participant_id' : 'participant_id'}_${eventId}`;
          const targetKey = isOrganizer ? organizerKey : participantKey;
          const targetIdKey = `${isOrganizer ? 'organizer_participant_id' : 'participant_id'}_${eventId}`;
          const otherToken = localStorage.getItem(targetKey);

          if (otherToken && otherToken !== token) {
            localStorage.setItem(sourceIdKey, participantId);
          } else {
            localStorage.setItem(targetKey, token);
            localStorage.setItem(targetIdKey, participantId);
            if (sourceKey !== targetKey && localStorage.getItem(sourceKey) === token) {
              localStorage.removeItem(sourceKey);
              localStorage.removeItem(sourceIdKey);
            }
          }
        }
        set({
          isOrganizerMode: isOrganizer,
          organizerToken: isOrganizer ? token : null,
          organizerParticipantId: isOrganizer ? participantId : null,
          isParticipantMode: !isOrganizer,
          participantToken: isOrganizer ? null : token,
          currentParticipantId: isOrganizer ? null : participantId,
        });
        return true;
      },

      rejectMeetingToken: (eventId, token) => {
        const organizerRejected = get().organizerToken === token;
        const participantRejected = get().participantToken === token;
        if (!organizerRejected && !participantRejected) return false;
        if (typeof window !== 'undefined') {
          if (organizerRejected && localStorage.getItem(`organizer_token_${eventId}`) === token) {
            localStorage.removeItem(`organizer_token_${eventId}`);
            localStorage.removeItem(`organizer_participant_id_${eventId}`);
          }
          if (participantRejected && localStorage.getItem(`participant_token_${eventId}`) === token) {
            localStorage.removeItem(`participant_token_${eventId}`);
            localStorage.removeItem(`participant_id_${eventId}`);
          }
        }
        set({
          ...(organizerRejected && {
            isOrganizerMode: false,
            organizerToken: null,
            organizerParticipantId: null,
          }),
          ...(participantRejected && {
            isParticipantMode: false,
            participantToken: null,
            currentParticipantId: null,
          }),
        });
        return true;
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
