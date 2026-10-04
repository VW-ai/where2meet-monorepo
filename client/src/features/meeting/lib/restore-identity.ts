import { eventClient } from '@/features/meeting/api';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { APIError } from '@/lib/api/client';

export async function restoreMeetingIdentity(eventId: string, token: string): Promise<void> {
  try {
    const participant = await eventClient.getMe(eventId, token);
    if (
      typeof participant.participantId !== 'string' ||
      !participant.participantId ||
      typeof participant.isOrganizer !== 'boolean'
    ) {
      throw new APIError(502, 'INVALID_RESPONSE', 'Invalid participant identity response');
    }
    if (useAuthStore.getState().confirmMeetingParticipant(
      eventId,
      token,
      participant.participantId,
      participant.isOrganizer
    )) {
      useVotingStore.getState().setMyParticipantId(participant.participantId);
    }
  } catch (error) {
    if (error instanceof APIError && (error.status === 401 || error.status === 403)) {
      if (useAuthStore.getState().rejectMeetingToken(eventId, token)) {
        useVotingStore.getState().setMyParticipantId(null);
      }
    }
    throw error;
  }
}
