'use client';

import { Share2 } from 'lucide-react';
import { SettingsDropdown } from './settings-dropdown';
import { useUIStore } from '@/store/ui-store';

interface TopRightActionsProps {
  eventId: string;
}

export function TopRightActions({ eventId }: TopRightActionsProps) {
  const { openShareModal } = useUIStore();

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Settings Dropdown */}
      <SettingsDropdown eventId={eventId} />

      {/* Share Button */}
      <button
        onClick={openShareModal}
        className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2 bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
        aria-label="Share event"
      >
        <Share2 className="w-5 h-5" />
        <span className="hidden md:inline">Share</span>
      </button>
    </div>
  );
}
