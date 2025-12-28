/**
 * Voting API Client Facade
 * This is the ONLY way voting-related code should access backend voting APIs.
 * Components must use votingClient, not @/lib/api/votes directly.
 */

import { votesApi } from '@/lib/api/votes';

export const votingClient = {
  castVote: votesApi.castVote,
  removeVote: votesApi.removeVote,
  getStatistics: votesApi.getStatistics,
};
