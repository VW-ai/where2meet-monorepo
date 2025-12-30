'use client';

import { PillNav } from './pill-nav';
import { FilterPills } from './filter-pills';
import { TopRightActions } from './top-right-actions';
import { ModeToggle } from './mode-toggle';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';

interface HeaderProps {
  eventId: string;
}

export function Header({ eventId }: HeaderProps) {
  const { currentEvent } = useMeetingStore();

  return (
    /* I removed the padding here so the elements float closer to the edges,
       but you can add p-3 md:p-4 back if you want spacing from the window edge */
    <header className="h-[10vh] min-h-[60px] w-full z-50">
      {/* SEO: Hidden h1 with event title for search engines */}
      <h1 className="sr-only">{currentEvent?.title || 'Meeting Event'}</h1>

      <div className="h-full w-full bg-transparent flex items-center px-3 sm:px-4 md:px-5 lg:px-6 gap-2 sm:gap-3 md:gap-4">
        {/* Left: PillNav (Logo + View Toggles) */}
        <div className="flex-shrink-0 pr-2 sm:pr-3 md:pr-4">
          <PillNav />
        </div>

        {/* Right: Filter Pills + Actions - min-w-0 REQUIRED */}
        <div className="flex-1 flex items-center justify-between gap-2 sm:gap-3 md:gap-4 min-w-0">
          {/* Center: Filter Pills - min-w-0 REQUIRED */}
          <div className="flex-1 flex items-center justify-center overflow-hidden min-w-0">
            <FilterPills />
          </div>

          {/* Right: Mode Toggle + Settings + Share - min-w-0 REQUIRED */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0 min-w-0">
            <ModeToggle />
            <TopRightActions eventId={eventId} />
          </div>
        </div>
      </div>
    </header>
  );
}
