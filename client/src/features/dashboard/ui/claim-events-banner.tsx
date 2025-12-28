'use client';

import { useState } from 'react';
import { useTokenClaimer } from '@/features/auth/hooks/useTokenClaimer';

export function ClaimEventsBanner() {
  const { unclaimedEvents, isScanning, claimAllEvents } = useTokenClaimer();
  const [isClaiming, setIsClaiming] = useState(false);

  if (isScanning || unclaimedEvents.length === 0) {
    return null;
  }

  const handleClaimAll = async () => {
    setIsClaiming(true);
    try {
      await claimAllEvents();
    } catch (error) {
      console.error('Error claiming events:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  const organizerCount = unclaimedEvents.filter((e) => e.tokenType === 'organizer').length;
  const participantCount = unclaimedEvents.filter((e) => e.tokenType === 'participant').length;

  return (
    <div className="bg-mint-50 border border-mint-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-mint-100 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-mint-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Unclaimed Events Found</h3>
          <p className="text-sm text-gray-600 mb-4">
            You have {unclaimedEvents.length} unclaimed{' '}
            {unclaimedEvents.length === 1 ? 'event' : 'events'}
            {organizerCount > 0 &&
              ` (${organizerCount} as organizer${organizerCount > 1 ? 's' : ''})`}
            {participantCount > 0 &&
              ` (${participantCount} as participant${participantCount > 1 ? 's' : ''})`}
            . Claim them to manage them in your dashboard.
          </p>

          <button
            onClick={handleClaimAll}
            disabled={isClaiming}
            className="px-4 py-2 bg-mint-600 text-white rounded-full text-sm font-medium hover:bg-mint-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isClaiming
              ? 'Claiming...'
              : `Claim All ${unclaimedEvents.length} Event${unclaimedEvents.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
