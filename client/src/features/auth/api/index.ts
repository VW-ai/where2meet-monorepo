/**
 * Auth API Client Facade
 * This is the ONLY way auth-related code should access backend auth APIs.
 * Components must use authClient, not @/lib/api/auth directly.
 *
 * NOTE: Handlers are NOT exported here to avoid pulling server-side code into client bundles.
 * Import handlers directly in route files: import { handleX } from '@/features/auth/api/handlers/x'
 */

import { authApi } from '@/lib/api/auth';

export const authClient = {
  register: authApi.register,
  login: authApi.login,
  logout: authApi.logout,
  getSession: authApi.getSession,
  claimToken: authApi.claimToken,
  requestPasswordReset: authApi.requestPasswordReset,
  resetPassword: authApi.resetPassword,
};
