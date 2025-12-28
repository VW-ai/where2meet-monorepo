import { useState, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { userClient } from '@/features/user/api';
import {
  scanLocalStorageForTokens,
  cleanupObsoleteTokens,
  UnclaimedToken,
} from '@/lib/utils/token-claimer';

// Keep for backward compatibility
interface UnclaimedEvent extends UnclaimedToken {}

export function useTokenClaimer() {
  const { user } = useAuthStore();
  const [unclaimedEvents, setUnclaimedEvents] = useState<UnclaimedEvent[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsScanning(false);
      return;
    }

    // Clean up obsolete ot_ tokens from old backend version
    cleanupObsoleteTokens();

    // Use shared utility to scan localStorage for valid pt_ tokens
    const unclaimed = scanLocalStorageForTokens();
    setUnclaimedEvents(unclaimed);
    setIsScanning(false);
  }, [user]);

  const claimEvent = async (eventId: string, tokenType: 'organizer' | 'participant') => {
    const eventToClaim = unclaimedEvents.find(
      (e) => e.eventId === eventId && e.tokenType === tokenType
    );

    if (!eventToClaim) {
      throw new Error('Event not found in unclaimed list');
    }

    try {
      await userClient.claimEvent({
        eventId,
        participantToken: eventToClaim.token,
      });

      // Remove from localStorage
      localStorage.removeItem(`${tokenType}_token_${eventId}`);
      if (tokenType === 'organizer') {
        localStorage.removeItem(`organizer_participant_id_${eventId}`);
      } else {
        localStorage.removeItem(`participant_id_${eventId}`);
      }

      // Update state
      setUnclaimedEvents((prev) =>
        prev.filter((e) => !(e.eventId === eventId && e.tokenType === tokenType))
      );
    } catch (error) {
      console.error('Error claiming event:', error);
      throw error;
    }
  };

  const claimAllEvents = async () => {
    const claimPromises = unclaimedEvents.map((event) =>
      claimEvent(event.eventId, event.tokenType).catch((error) => {
        console.error(`Failed to claim event ${event.eventId}:`, error);
        return null;
      })
    );

    await Promise.all(claimPromises);
  };

  return {
    unclaimedEvents,
    isScanning,
    claimEvent,
    claimAllEvents,
  };
}
