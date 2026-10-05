'use client';

import { MapPin, EyeOff, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { TravelTimeBubble } from './travel-time-bubble';
import type { Participant } from '@/entities';

interface ParticipantPillProps {
  participant: Participant;
  travelTime?: string;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** The viewer's own participant record */
  isYou?: boolean;
  /** Handler for "Add starting location" when there is no address (defaults to onEdit) */
  onAddLocation?: () => void;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function ParticipantPill({
  participant,
  travelTime,
  onClick,
  onEdit,
  onDelete,
  isYou = false,
  onAddLocation,
}: ParticipantPillProps) {
  const initials = getInitials(participant.name);
  const addLocation = onAddLocation ?? onEdit;

  return (
    <div className="relative w-full py-2 pl-6 pr-1 group overflow-visible">
      <div className="flex items-center gap-3 overflow-visible">
        <div
          className={cn(
            'relative z-10 flex items-center cursor-pointer transition-transform hover:-translate-y-0.5 overflow-visible transition-all duration-300',
            travelTime ? 'flex-1 min-w-0' : 'w-full md:max-w-[400px]'
          )}
          onClick={onClick}
        >
          {/* --- THE TAIL ---
            Positioned absolutely to the left.
            The 'group-hover' class makes it wag when hovering the main container.
          */}
          <div className="absolute -left-5 bottom-2 z-0 w-12 h-12 origin-right transition-transform duration-500 ease-in-out group-hover:rotate-12">
            <svg viewBox="0 0 50 50" className="w-full h-full" style={{ overflow: 'visible' }}>
              {/* Main Tail Stroke */}
              <path
                d="M 45 25 C 35 25, 30 45, 10 35"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="text-border"
              />
              {/* Inner Detail (Fluff) */}
              <path
                d="M 45 25 C 35 25, 30 45, 10 35"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 6"
                className={cn(
                  'opacity-30',
                  participant.color?.replace('bg-', 'text-') || 'text-gray-400'
                )}
              />
              {/* Tail Tip */}
              <circle
                cx="10"
                cy="35"
                r="3"
                className={cn(
                  'fill-current',
                  participant.color?.replace('bg-', 'text-') || 'text-gray-400'
                )}
              />
            </svg>
          </div>

          {/* --- MAIN BODY PILL ---
            Added z-10 to ensure it sits ON TOP of the tail connection point
          */}
          <div className="relative flex-1 flex items-center justify-between bg-white border-2 border-border rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all z-10 min-w-0">
            {/* Left side - Info */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-foreground truncate">
                  {participant.name}
                </span>
                {isYou && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-coral-100 text-[10px] font-semibold uppercase tracking-wide text-coral-700">
                    You
                  </span>
                )}
                {participant.fuzzyLocation && (
                  <span
                    className="inline-flex items-center justify-center bg-muted/50 rounded-full p-0.5 flex-shrink-0"
                    title="Fuzzy location enabled"
                  >
                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                  </span>
                )}
              </div>
              {participant.location ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate font-medium min-w-0">
                    {participant.fuzzyLocation ? 'Approximate location' : participant.address}
                  </span>
                </div>
              ) : addLocation ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addLocation();
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-coral-600 hover:text-coral-700 hover:underline min-w-0 text-left"
                >
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Add starting location</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs italic text-muted-foreground min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">No starting location yet</span>
                </div>
              )}
            </div>

            {/* Right side - Avatar Head and Actions */}
            <div className="relative flex items-center flex-shrink-0">
              {/* Edit/Delete Actions - always shown on touch screens; on pointer devices they
                  float over the text and appear on hover or keyboard focus */}
              {(onEdit || onDelete) && (
                <div
                  className={cn(
                    'flex items-center gap-1 mr-2 transition-opacity duration-200',
                    '[@media(hover:hover)]:absolute [@media(hover:hover)]:right-12 [@media(hover:hover)]:mr-0',
                    '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none',
                    '[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto',
                    '[@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto'
                  )}
                >
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="p-2 [@media(hover:hover)]:p-1.5 rounded-lg hover:bg-coral-50 text-muted-foreground hover:text-coral-600 transition-colors bg-white shadow-sm"
                      aria-label={`Edit ${participant.name}`}
                      title="Edit participant"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="p-2 [@media(hover:hover)]:p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors bg-white shadow-sm"
                      aria-label={`Remove ${participant.name}`}
                      title="Delete participant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Face/Avatar */}
              <div
                className={cn(
                  'relative z-10 w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-sm tracking-wider',
                  participant.color || 'bg-gray-400'
                )}
              >
                {initials}
              </div>
            </div>

            {/* --- FEET ---
               Moved inside the pill container, absolutely positioned at the bottom.
               They now look like paws holding the border.
            */}
            <div className="absolute -bottom-1.5 left-8 flex gap-4">
              <div className="w-2.5 h-1.5 rounded-b-full bg-border border border-t-0 border-black/10" />
              <div className="w-2.5 h-1.5 rounded-b-full bg-border border border-t-0 border-black/10" />
            </div>
          </div>
        </div>

        {/* Travel Time Bubble - appears when venue is selected, flows in flex container */}
        {travelTime && (
          <div className="flex-shrink-0">
            <TravelTimeBubble travelTime={travelTime} isVisible={true} />
          </div>
        )}
      </div>
    </div>
  );
}
