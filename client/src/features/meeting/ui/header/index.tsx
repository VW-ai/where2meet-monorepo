'use client';

import { PillNav } from './pill-nav';
import { FilterPills } from './filter-pills';
import { TopRightActions } from './top-right-actions';
import { ModeToggle } from './mode-toggle';

interface HeaderProps {
  eventId: string;
}

export function Header({ eventId }: HeaderProps) {
  return (
    /* I removed the padding here so the elements float closer to the edges, 
       but you can add p-3 md:p-4 back if you want spacing from the window edge */
    <header className="h-[10vh] min-h-[60px] w-full z-50">
      <div className="h-full w-full bg-transparent flex items-center px-4 md:px-6">
        {/* Left: PillNav (Logo + View Toggles) */}
        <div className="flex-shrink-0 pr-4 md:pr-6">
          <PillNav />
        </div>

        {/* Right: Filter Pills + Actions */}
        <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
          {/* Center: Filter Pills */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <FilterPills />
          </div>

          {/* Right: Mode Toggle + Settings + Share */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <ModeToggle />
            <TopRightActions eventId={eventId} />
          </div>
        </div>
      </div>
    </header>
  );
}
