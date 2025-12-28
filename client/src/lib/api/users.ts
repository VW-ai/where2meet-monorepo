import { apiCall } from './client';
import { User, UpdateUserDTO } from '@/features/auth/types';
import { Event } from '@/entities';

export const usersApi = {
  getProfile: () => apiCall<User>('/api/users/me'),

  updateProfile: (data: UpdateUserDTO) =>
    apiCall<User>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getEvents: () => apiCall<Event[]>('/api/users/me/events'),

  getIdentities: () => apiCall<{ identities: Array<{ id: string; provider: 'email' | 'google' | 'github'; providerId: string; createdAt: string }> }>('/api/users/me/identities'),

  unlinkIdentity: (provider: string) =>
    apiCall<{ success: boolean }>('/api/users/me/identities/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),
};
