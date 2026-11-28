import { venueClient } from '@/features/meeting/api';
import { votingClient } from '@/features/voting/api';
import { venueVoteData } from '@/features/voting/model/venue-vote-data';

/**
 * Puts the place a reader came from into the new meeting as the organizer's vote.
 * Resolves to whether the vote landed; a failure never reaches the organizer.
 */
export async function voteForSeedPlace(
  eventId: string,
  participantId: string,
  token: string,
  placeId: string
): Promise<boolean> {
  try {
    const venue = await venueClient.get(placeId);
    await votingClient.castVote(
      eventId,
      participantId,
      { venueId: venue.id, venueData: venueVoteData(venue) },
      token
    );
    return true;
  } catch (error) {
    console.error('[PlanSeed] Could not add the seeded place:', error);
    return false;
  }
}
