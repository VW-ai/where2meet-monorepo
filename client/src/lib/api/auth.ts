import { apiCall } from './client'; // Use apiCall for Next.js API routes
import { User, RegisterDTO, LoginDTO } from '@/features/auth/types';

export const authApi = {
  register: (data: RegisterDTO) =>
    apiCall<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginDTO) =>
    apiCall<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () => apiCall('/api/auth/logout', { method: 'POST' }),

  getSession: () => apiCall<{ user: User }>('/api/auth/session'),

  requestPasswordReset: (email: string) =>
    apiCall('/api/auth/recovery/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data: { token: string; newPassword: string }) =>
    apiCall('/api/auth/recovery/reset', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
