'use client';

import { Lock } from 'lucide-react';

interface Props {
  isPublished: boolean;
}

export function MapBlurOverlay({ isPublished }: Props) {
  if (isPublished) {
    // Show locked message for published events
    return (
      <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/40 backdrop-blur-lg pointer-events-auto">
        <div className="max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Event Published</h2>
            <p className="text-gray-600">
              This event is published and no longer accepts new participants. Only existing
              participants can view details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // For non-published events, show arrows pointing to Join Event button in sidebar
  return (
    <div className="absolute inset-0 z-[5] bg-white/40 backdrop-blur-lg pointer-events-none">
      {/* Animated pointer to sidebar - Mobile (bottom) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:hidden">
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <span className="text-sm font-semibold text-gray-900 drop-shadow-lg bg-coral-100 px-4 py-2 rounded-full border-2 border-coral-500">
            Click "Join Event" in sidebar below
          </span>
          <svg
            className="w-10 h-10 text-coral-500 drop-shadow-lg"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 4l-8 8h5v8h6v-8h5z" transform="rotate(180 12 12)" />
          </svg>
        </div>
      </div>

      {/* Animated pointer to sidebar - Desktop (left) */}
      <div className="hidden md:block absolute left-8 top-1/2 -translate-y-1/2">
        <div className="flex items-center gap-3 animate-pulse">
          <svg
            className="w-10 h-10 text-coral-500 drop-shadow-lg"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20 12l-8-8v5H4v6h8v5z" transform="rotate(180 12 12)" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 drop-shadow-lg bg-coral-100 px-4 py-2 rounded-full border-2 border-coral-500">
            Click "Join Event" in sidebar
          </span>
        </div>
      </div>
    </div>
  );
}
