import { apiCall } from './client';
import { User, UpdateUserDTO, ClaimTokenDTO, UserEventResponse } from '@/features/auth/types';

export const usersApi = {
  getProfile: () => apiCall<User>('/api/users/me'),

  updateProfile: (data: UpdateUserDTO, signal?: AbortSignal) =>
    apiCall<User>('/api/users/me', {
      method: 'PATCH',
      signal,
      body: JSON.stringify(data),
    }),

  getEvents: (signal?: AbortSignal) =>
    apiCall<{ events: UserEventResponse[] }>('/api/users/me/events', { signal }),

  claimEvent: (data: ClaimTokenDTO, signal?: AbortSignal) =>
    apiCall('/api/users/me/events/claim', {
      method: 'POST',
      signal,
      body: JSON.stringify(data),
    }),

  getIdentities: () =>
    apiCall<{
      identities: Array<{
        id: string;
        provider: 'email' | 'google' | 'github';
        providerId: string;
        createdAt: string;
      }>;
    }>('/api/users/me/identities'),

  unlinkIdentity: (provider: string) =>
    apiCall<{ success: boolean }>('/api/users/me/identities/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),
};
