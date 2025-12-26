import { apiCall } from './client';
import { User, UpdateUserDTO } from '@/types/user';
import { Event } from '@/types';

export const usersApi = {
  getProfile: () => apiCall<User>('/api/users/me'),

  updateProfile: (data: UpdateUserDTO) =>
    apiCall<User>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getEvents: () => apiCall<Event[]>('/api/users/me/events'),
};
