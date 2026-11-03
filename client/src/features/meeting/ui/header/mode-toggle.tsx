'use client';

import { useAuthStore } from '@/features/auth/model/auth-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    organizerHint: 'You created this event',
    participantHint: 'You are viewing as a participant',
    organizer: 'Organizer',
    participant: 'Participant',
  },
  zh: {
    organizerHint: '这个见面是你发起的',
    participantHint: '你正以参与者身份查看',
    organizer: '发起人',
    participant: '参与者',
  },
});

/**
 * Mode indicator (read-only)
 * Shows whether user is organizer or participant based on token in localStorage
 * No toggle functionality - mode is determined automatically
 */
export function ModeToggle() {
  const t = useMessages(messages);
  const { isOrganizerMode } = useAuthStore();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        isOrganizerMode
          ? 'bg-coral-100 text-coral-700 border border-coral-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200'
      )}
      title={isOrganizerMode ? t.organizerHint : t.participantHint}
    >
      <span
        className={cn('w-2 h-2 rounded-full', isOrganizerMode ? 'bg-coral-500' : 'bg-gray-400')}
      />
      <span className="hidden sm:inline">{isOrganizerMode ? t.organizer : t.participant}</span>
    </div>
  );
}
