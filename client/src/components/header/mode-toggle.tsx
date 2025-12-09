'use client';

import { useUIStore } from '@/store/ui-store';
import { cn } from '@/lib/utils/cn';

export function ModeToggle() {
  const { isOrganizerMode, toggleOrganizerMode } = useUIStore();

  return (
    <button
      onClick={toggleOrganizerMode}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
        isOrganizerMode
          ? 'bg-coral-100 text-coral-700 border border-coral-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200'
      )}
      aria-pressed={isOrganizerMode}
      title={isOrganizerMode ? 'You are the organizer' : 'View as participant'}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full transition-colors duration-200',
          isOrganizerMode ? 'bg-coral-500' : 'bg-gray-400'
        )}
      />
      <span className="hidden sm:inline">{isOrganizerMode ? 'Organizer' : 'Participant'}</span>
    </button>
  );
}
