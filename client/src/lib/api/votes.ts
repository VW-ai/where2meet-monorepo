/**
 * Voting API
 *
 * Status: MIGRATED to backend (Milestone 5)
 * Calls backend directly at http://localhost:3000
 *
 * Endpoints:
 * - POST /api/events/:id/votes - Cast a vote for a venue
 * - DELETE /api/events/:id/votes - Remove a vote for a venue
 * - GET /api/events/:id/votes - Get aggregated vote statistics
 */

import { backendCall } from './client';
import type {
  CastVoteRequest,
  CastVoteResponse,
  RemoveVoteResponse,
  VoteStatisticsResponse,
} from '@/shared/types/api';

export const votesApi = {
  /**
   * Cast a vote for a venue
   * Requires: organizerToken OR participantToken (for self only)
   *
   * @param eventId - Event ID
   * @param participantId - Participant ID (in URL path)
   * @param data - Vote data (venueId, venueData)
   * @param token - Authorization token (organizerToken or participantToken)
   * @returns Vote confirmation with voteId
   */
  castVote: (eventId: string, participantId: string, data: CastVoteRequest, token: string) =>
    backendCall<CastVoteResponse>(`/api/events/${eventId}/participants/${participantId}/votes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  /**
   * Remove a vote for a venue
   * Requires: organizerToken OR participantToken (for self only)
   *
   * @param eventId - Event ID
   * @param participantId - Participant ID (in URL path)
   * @param venueId - Venue ID (in URL path)
   * @param token - Authorization token (organizerToken or participantToken)
   * @returns Success confirmation
   */
  removeVote: (eventId: string, participantId: string, venueId: string, token: string) =>
    backendCall<RemoveVoteResponse>(
      `/api/events/${eventId}/participants/${participantId}/votes/${venueId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Get aggregated vote statistics for an event
   * Public endpoint - no auth required
   *
   * @param eventId - Event ID
   * @returns Vote statistics with venue list and vote counts
   */
  getStatistics: (eventId: string) =>
    backendCall<VoteStatisticsResponse>(`/api/events/${eventId}/votes`),
};
