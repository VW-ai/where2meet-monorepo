'use client';

import { useMeetingStore } from '@/store/useMeetingStore';
import { Users } from 'lucide-react';

export function ParticipantSection() {
  const { currentEvent } = useMeetingStore();

  const participantCount = currentEvent?.participants?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" />
          Participants
        </h2>
        {participantCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {/* Placeholder Content */}
      <div className="py-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-coral-100 flex items-center justify-center">
          <Users className="w-8 h-8 text-coral-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Participant Management Coming Soon
          </p>
          <p className="text-xs text-muted-foreground">
            Add and manage participants for this event
          </p>
        </div>
        {/* Placeholder list */}
        {participantCount > 0 && (
          <div className="mt-6 space-y-2 text-left">
            <p className="text-xs font-medium text-muted-foreground px-2">Current participants:</p>
            {currentEvent?.participants?.map((participant) => (
              <div key={participant.id} className="p-3 rounded-lg bg-gray-50 border border-border">
                <p className="text-sm font-medium text-foreground">{participant.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{participant.address}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
