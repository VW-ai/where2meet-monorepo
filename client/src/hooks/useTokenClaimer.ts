import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/api';
import { scanLocalStorageForTokens, UnclaimedToken } from '@/lib/utils/token-claimer';

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

    // Use shared utility to scan localStorage
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
      await api.auth.claimToken({
        eventId,
        token: eventToClaim.token,
        tokenType,
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
