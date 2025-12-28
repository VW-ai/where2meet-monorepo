/**
 * User API Client Facade
 * This is the ONLY way user-related code should access backend user APIs.
 * Components must use userClient, not @/lib/api/users directly.
 *
 * NOTE: Handlers are NOT exported here to avoid pulling server-side code into client bundles.
 * Import handlers directly in route files: import { handleX } from '@/features/user/api/handlers/x'
 */

import { usersApi } from '@/lib/api/users';

export const userClient = {
  getProfile: usersApi.getProfile,
  updateProfile: usersApi.updateProfile,
  getEvents: usersApi.getEvents,
  claimEvent: usersApi.claimEvent,
  getIdentities: usersApi.getIdentities,
  unlinkIdentity: usersApi.unlinkIdentity,
};
