/**
 * Participant API Client Facade
 * Meeting feature's interface to participant-related backend APIs.
 */

import { participantsApi } from '@/lib/api/participants';

export const participantClient = {
  join: participantsApi.join,
  add: participantsApi.add,
  update: participantsApi.update,
  remove: participantsApi.remove,
};
