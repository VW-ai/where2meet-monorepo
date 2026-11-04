/**
 * Participants API
 *
 * Status: MIGRATED to backend (Milestone 3)
 * Calls backend directly at http://localhost:3000
 */

import {
  CreateParticipantDTO,
  UpdateParticipantDTO,
  ParticipantResponse,
  Participant,
} from '@/entities';
import { parseParticipant } from '@/entities/participant/parse';
import { backendCall } from './client';

export const participantsApi = {
  /**
   * Self-registration: User joins event themselves (no auth required)
   * Returns participantToken for self-management
   */
  join: (eventId: string, data: CreateParticipantDTO) =>
    backendCall<ParticipantResponse>(`/api/events/${eventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(parseParticipant),

  /**
   * Organizer adds a participant (requires organizerToken)
   * No participantToken returned - organizer manages this participant
   */
  add: (eventId: string, data: CreateParticipantDTO, organizerToken: string) =>
    backendCall<Participant>(`/api/events/${eventId}/participants`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
      body: JSON.stringify(data),
    }).then(parseParticipant),

  /**
   * Update a participant (requires token)
   * - organizerToken: can update any participant
   * - participantToken: can only update own record
   */
  update: (eventId: string, participantId: string, data: UpdateParticipantDTO, token: string) =>
    backendCall<Participant>(`/api/events/${eventId}/participants/${participantId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(parseParticipant),

  /**
   * Take a row the organizer added (no auth). Same shape as self-registration.
   * backendCall omits Content-Type without a body, which the server needs on an empty POST.
   */
  claim: (eventId: string, participantId: string) =>
    backendCall<ParticipantResponse>(
      `/api/events/${eventId}/participants/${participantId}/claim`,
      { method: 'POST' }
    ).then(parseParticipant),

  /** Undo a claim with the row's own token: it goes back to the organizer. */
  unclaim: (eventId: string, participantId: string, token: string) =>
    backendCall<Participant>(`/api/events/${eventId}/participants/${participantId}/claim`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(parseParticipant),

  /**
   * Remove a participant (requires token)
   * - organizerToken: can delete any participant
   * - participantToken: can only delete own record (leave event)
   */
  remove: (eventId: string, participantId: string, token: string) =>
    backendCall<{ success: true; message: string }>(
      `/api/events/${eventId}/participants/${participantId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};
