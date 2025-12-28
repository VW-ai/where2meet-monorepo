'use client';

import { useAuthStore } from '@/features/auth/model/auth-store';
import { cn } from '@/shared/lib/cn';

/**
 * Mode indicator (read-only)
 * Shows whether user is organizer or participant based on token in localStorage
 * No toggle functionality - mode is determined automatically
 */
export function ModeToggle() {
  const { isOrganizerMode } = useAuthStore();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        isOrganizerMode
          ? 'bg-coral-100 text-coral-700 border border-coral-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200'
      )}
      title={isOrganizerMode ? 'You created this event' : 'You are viewing as a participant'}
    >
      <span
        className={cn('w-2 h-2 rounded-full', isOrganizerMode ? 'bg-coral-500' : 'bg-gray-400')}
      />
      <span className="hidden sm:inline">{isOrganizerMode ? 'Organizer' : 'Participant'}</span>
    </div>
  );
}
