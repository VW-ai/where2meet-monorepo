import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, RegisterDTO, LoginDTO, UpdateUserDTO } from '@/types/user';
import { api } from '@/lib/api';
import { scanLocalStorageForTokens, claimAllTokens } from '@/lib/utils/token-claimer';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterDTO) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>; // Called on app load
  updateProfile: (data: UpdateUserDTO) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

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
          const response = await api.auth.register(data);
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
          const response = await api.auth.login({ email, password });
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
          await api.auth.logout();
          // Backend clears session cookie
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      // Check if session is valid (called once on app load)
      checkSession: async () => {
        try {
          set({ isLoading: true });
          const response = await api.auth.getSession();
          set({ user: response.user, isAuthenticated: true });
        } catch (error) {
          // Session expired or invalid
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      // Update user profile
      updateProfile: async (data) => {
        const updated = await api.users.updateProfile(data);
        set({ user: updated });
      },

      // Clear error message
      clearError: () => set({ error: null }),
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
