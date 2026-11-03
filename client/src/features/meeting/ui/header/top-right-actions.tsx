'use client';

import { Share2 } from 'lucide-react';
import { SettingsDropdown } from './settings-dropdown';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: { shareEvent: 'Share event', share: 'Share' },
  zh: { shareEvent: '分享见面', share: '分享' },
});

interface TopRightActionsProps {
  eventId: string;
}

export function TopRightActions({ eventId }: TopRightActionsProps) {
  const t = useMessages(messages);
  const { openShareModal } = useUIStore();

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Settings Dropdown */}
      <SettingsDropdown eventId={eventId} />

      {/* Share Button */}
      <button
        data-tutorial="share-button"
        onClick={openShareModal}
        className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2 bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
        aria-label={t.shareEvent}
      >
        <Share2 className="w-5 h-5" />
        <span className="hidden md:inline">{t.share}</span>
      </button>
    </div>
  );
}
