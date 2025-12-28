'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { cn } from '@/shared/lib/cn';

// Helper to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Parse duration string to minutes for comparison
const parseDurationToMinutes = (duration: string): number => {
  // Handle formats like "15 mins", "1 hour 30 mins", "2 hours"
  let totalMinutes = 0;

  const hourMatch = duration.match(/(\d+)\s*hour/i);
  const minMatch = duration.match(/(\d+)\s*min/i);

  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
  }
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1]);
  }

  // If no match, try to parse as just a number
  if (totalMinutes === 0) {
    const numMatch = duration.match(/(\d+)/);
    if (numMatch) {
      totalMinutes = parseInt(numMatch[1]);
    }
  }

  return totalMinutes;
};

export function ParticipantStats() {
  const { isParticipantStatsOpen, closeParticipantStats } = useUIStore();
  const { currentEvent, selectedVenue } = useMeetingStore();
  const { routes, travelMode } = useMapStore();

  const participants = currentEvent?.participants || [];

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isParticipantStatsOpen) {
        closeParticipantStats();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isParticipantStatsOpen, closeParticipantStats]);

  // Get travel time for a participant
  const getTravelTime = (participantId: string): string | null => {
    const route = routes.find((r) => r.participantId === participantId);
    return route?.duration || null;
  };

  // Calculate stats
  const participantsWithTimes = participants
    .map((p) => ({
      ...p,
      travelTime: getTravelTime(p.id),
      travelMinutes: getTravelTime(p.id) ? parseDurationToMinutes(getTravelTime(p.id)!) : 0,
    }))
    .filter((p) => p.travelTime !== null);

  const maxMinutes = Math.max(...participantsWithTimes.map((p) => p.travelMinutes), 1);

  // Travel mode labels
  const travelModeLabel: Record<string, string> = {
    car: 'Driving',
    transit: 'Transit',
    walk: 'Walking',
    bike: 'Cycling',
  };

  return (
    <aside
      className={cn(
        // Mobile: slide from bottom
        'fixed bottom-0 left-0 right-0 h-[50vh] w-full',
        // Desktop: position next to sidebar
        'md:absolute md:top-[10vh] md:bottom-3 md:h-auto md:max-h-[calc(90vh-1rem)]',
        'md:left-[calc(320px+24px)] lg:left-[calc(360px+24px)] xl:left-[calc(400px+24px)]',
        'md:w-[320px] lg:w-[360px] xl:w-[400px]',
        'md:right-auto',
        // Styling
        'bg-white/95 backdrop-blur-md shadow-2xl z-40',
        'border-t md:border-t-0 md:border-l border-border/50',
        'rounded-t-2xl md:rounded-2xl',
        'overflow-y-auto',
        'transition-all duration-300 ease-in-out',
        isParticipantStatsOpen
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-full md:translate-y-0 md:translate-x-[-20px] pointer-events-none'
      )}
      role="complementary"
      aria-labelledby="participant-stats-title"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 id="participant-stats-title" className="text-lg font-semibold text-foreground">
            Travel Time Stats
          </h2>
          <button
            onClick={closeParticipantStats}
            className="p-2 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500"
            aria-label="Close stats panel"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
        {selectedVenue && (
          <p className="text-sm text-muted-foreground mt-1 truncate">To: {selectedVenue.name}</p>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* No venue selected state */}
        {!selectedVenue && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Select a venue to see travel times</p>
          </div>
        )}

        {/* No participants state */}
        {selectedVenue && participants.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Add participants to see travel times</p>
          </div>
        )}

        {/* No routes calculated state */}
        {selectedVenue && participants.length > 0 && participantsWithTimes.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Calculating travel times...</p>
          </div>
        )}

        {/* Bar Graph */}
        {participantsWithTimes.length > 0 && (
          <div className="space-y-4">
            {/* Travel mode badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Travel Time by Participant
              </span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full capitalize">
                {travelModeLabel[travelMode] || travelMode}
              </span>
            </div>

            {/* Bar chart */}
            <div className="space-y-3">
              {participantsWithTimes
                .sort((a, b) => a.travelMinutes - b.travelMinutes)
                .map((participant) => {
                  const percentage = (participant.travelMinutes / maxMinutes) * 100;
                  return (
                    <div key={participant.id} className="space-y-1.5">
                      {/* Participant name and time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0',
                              participant.color || 'bg-gray-400'
                            )}
                          >
                            {getInitials(participant.name)}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">
                            {participant.name}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-foreground flex-shrink-0">
                          {participant.travelTime}
                        </span>
                      </div>
                      {/* Bar */}
                      <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500 ease-out',
                            participant.color?.replace('bg-', 'bg-') || 'bg-coral-500'
                          )}
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Summary stats */}
            <div className="pt-4 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shortest</span>
                <span className="font-medium text-mint-600">
                  {participantsWithTimes.sort((a, b) => a.travelMinutes - b.travelMinutes)[0]
                    ?.travelTime || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Longest</span>
                <span className="font-medium text-coral-600">
                  {participantsWithTimes.sort((a, b) => b.travelMinutes - a.travelMinutes)[0]
                    ?.travelTime || '-'}
                </span>
              </div>
              {participantsWithTimes.length > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Average</span>
                  <span className="font-medium text-foreground">
                    {Math.round(
                      participantsWithTimes.reduce((sum, p) => sum + p.travelMinutes, 0) /
                        participantsWithTimes.length
                    )}{' '}
                    mins
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
