'use client';

import { useUIStore } from '@/store/ui-store';
import { ParticipantSection } from './participant-section';
import { VenueSection } from './venue-section';

export function Sidebar() {
  const { activeView } = useUIStore();

  return (
    <aside
      className="
      w-full md:w-[30%] lg:w-[35%] xl:w-[30%]
      h-1/2 md:h-full
      border-b md:border-b-0 md:border-r border-border
      bg-background
      overflow-y-auto
    "
    >
      <div className="p-4 md:p-6 space-y-6">
        {/* Content based on active view */}
        {activeView === 'participant' ? <ParticipantSection /> : <VenueSection />}
      </div>
    </aside>
  );
}
