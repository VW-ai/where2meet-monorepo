/**
 * Participants API
 *
 * Status: MOCK (Next.js API routes)
 * TODO: Migrate when backend Milestone 3 is ready
 */

import { CreateParticipantDTO } from '@/types';
import { apiCall } from './client';

export const participantsApi = {
  add: (eventId: string, data: CreateParticipantDTO) =>
    apiCall(`/api/events/${eventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (eventId: string, participantId: string, data: Partial<CreateParticipantDTO>) =>
    apiCall(`/api/events/${eventId}/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (eventId: string, participantId: string) =>
    apiCall(`/api/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
    }),
};
