'use client';

import { PillNav } from './pill-nav';
import { FilterPills } from './filter-pills';
import { TopRightActions } from './top-right-actions';

interface HeaderProps {
  eventId: string;
}

export function Header({ eventId }: HeaderProps) {
  return (
    <header className="h-[10vh] min-h-[60px] border-b border-border">
      <div className="h-full flex items-center">
        {/* Left: PillNav (Logo + View Toggles) - 30% (matches sidebar) */}
        <div className="w-full md:w-[30%] lg:w-[35%] xl:w-[30%] px-4 md:px-6">
          <PillNav />
        </div>

        {/* Right: Filter Pills + Actions - 70% */}
        <div className="flex-1 px-4 md:px-6 flex items-center justify-between gap-4">
          {/* Center: Filter Pills */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <FilterPills />
          </div>

          {/* Right: Settings + Share */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <TopRightActions eventId={eventId} />
          </div>
        </div>
      </div>
    </header>
  );
}
