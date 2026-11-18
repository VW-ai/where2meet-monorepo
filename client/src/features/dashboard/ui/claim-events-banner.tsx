'use client';

import { useState } from 'react';
import { useTokenClaimer } from '@/features/auth/hooks/useTokenClaimer';
import { accountStyles as s } from '@/features/auth/ui/account-shell';
import { CatLoader } from '@/components/cat/cat-loader';

// Meetings opened in this browser before signing in, not yet on the account
export function ClaimEventsBanner({ onClaimed }: { onClaimed?: () => void }) {
  const { unclaimedEvents, isScanning, claimAllEvents } = useTokenClaimer();
  const [isClaiming, setIsClaiming] = useState(false);

  if (isScanning || unclaimedEvents.length === 0) {
    return null;
  }

  const handleClaimAll = async () => {
    setIsClaiming(true);
    try {
      await claimAllEvents();
      onClaimed?.();
    } catch (error) {
      console.error('Error claiming events:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  const count = unclaimedEvents.length;
  const noun = count === 1 ? 'meeting' : 'meetings';

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[22px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.08)] sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-[15px] font-semibold">
          {count} {noun} on this device {count === 1 ? "isn't" : "aren't"} saved yet
        </p>
        <p className="mt-0.5 text-sm text-[#666b73]">
          Add {count === 1 ? 'it' : 'them'} to your account to see {count === 1 ? 'it' : 'them'}{' '}
          anywhere you sign in.
        </p>
      </div>
      <button onClick={handleClaimAll} disabled={isClaiming} className={s.primaryButton}>
        {isClaiming && <CatLoader size={18} onColor />}
        {isClaiming ? 'Saving…' : `Save ${count} ${noun}`}
      </button>
    </div>
  );
}
