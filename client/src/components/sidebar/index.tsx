'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/ui-store';
import { ParticipantSection } from './participant-section';
import { VenueSection } from './venue-section';
import { cn } from '@/lib/utils/cn';

export function Sidebar() {
  const { activeView, isSidebarVisible } = useUIStore();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayView, setDisplayView] = useState(activeView);

  useEffect(() => {
    if (activeView !== displayView) {
      setIsTransitioning(true);

      // Wait for fade-out to complete, then switch content and fade-in
      const timer = setTimeout(() => {
        setDisplayView(activeView);
        setIsTransitioning(false);
      }, 200); // Half of total transition time for fade-out

      return () => clearTimeout(timer);
    }
  }, [activeView, displayView]);

  return (
    <aside
      className={cn(
        'h-full w-full',
        'md:w-[320px] lg:w-[360px] xl:w-[400px]',
        'md:max-w-[30vw]',
        'md:ml-3 md:mr-0',
        'rounded-b-2xl md:rounded-2xl',
        'overflow-y-auto overflow-x-visible',
        'transition-transform duration-300 ease-in-out',
        // Semi-transparent background
        'bg-white/90 backdrop-blur-md',
        'border border-border/50',
        'shadow-xl',
        // Mobile: slide from bottom
        isSidebarVisible ? 'translate-y-0' : 'translate-y-full md:translate-y-0',
        // Desktop: slide from left
        isSidebarVisible ? 'md:translate-x-0' : 'md:-translate-x-full'
      )}
    >
      <div className="p-4 md:p-6 space-y-6 relative">
        {/* Content based on active view with smooth cross-fade transitions */}
        <div
          className={cn(
            'transition-opacity duration-200 ease-in-out',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
        >
          {displayView === 'participant' ? <ParticipantSection /> : <VenueSection />}
        </div>
      </div>
    </aside>
  );
}
