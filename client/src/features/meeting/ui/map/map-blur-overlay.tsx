'use client';

import { UserPlus, Lock } from 'lucide-react';

interface Props {
  onJoinClick: () => void;
  isPublished: boolean;
}

export function MapBlurOverlay({ onJoinClick, isPublished }: Props) {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/40 backdrop-blur-lg pointer-events-auto">
      <div className="max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          {isPublished ? (
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-8 h-8 text-gray-600" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-coral-100 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-coral-600" />
            </div>
          )}

          {/* Heading */}
          <h2 className="text-2xl font-semibold text-gray-900">
            {isPublished ? 'Event Published' : 'Join the Event'}
          </h2>

          {/* Description */}
          <p className="text-gray-600">
            {isPublished
              ? 'This event is published and no longer accepts new participants. Only existing participants can view details.'
              : 'To see participant locations, search venues, and vote, please join this event'}
          </p>

          {/* CTA Button - only show for non-published events */}
          {!isPublished && (
            <button
              onClick={onJoinClick}
              className="w-full mt-4 px-6 py-3 bg-coral-500 hover:bg-coral-600 text-white font-medium rounded-lg transition-colors"
            >
              Join Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
