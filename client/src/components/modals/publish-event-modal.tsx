'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, MapPin } from 'lucide-react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useUIStore } from '@/store/ui-store';

export function PublishEventModal() {
  const { isPublishModalOpen, closePublishModal } = useUIStore();
  const { currentEvent, selectedVenue, updateEvent } = useMeetingStore();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Reset published state when modal opens
  useEffect(() => {
    if (isPublishModalOpen) {
      setIsPublished(false);
    }
  }, [isPublishModalOpen]);

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePublishModal();
      }
    },
    [closePublishModal]
  );

  useEffect(() => {
    if (isPublishModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPublishModalOpen, handleEscape]);

  const handlePublish = async () => {
    if (!currentEvent) return;

    setIsPublishing(true);

    try {
      // Update event with selected venue as final location
      updateEvent({
        publishedVenueId: selectedVenue?.id || null,
        publishedAt: new Date().toISOString(),
      });

      setIsPublished(true);

      // Auto close after 2 seconds
      setTimeout(() => {
        closePublishModal();
      }, 2000);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isPublishModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closePublishModal}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isPublished ? (
          // Success state
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-mint-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-mint-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Event Published!</h2>
            <p className="text-sm text-muted-foreground">
              Participants have been notified of the final venue.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Publish Event</h2>
              <button
                onClick={closePublishModal}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Publishing this event will finalize the meeting location and notify all
                participants.
              </p>

              {selectedVenue ? (
                <div className="p-4 bg-mint-50 rounded-xl border border-mint-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-mint-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{selectedVenue.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedVenue.address}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    No venue selected. Select a venue before publishing to include a location.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={closePublishModal}
                className="flex-1 px-4 py-3 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="flex-1 px-4 py-3 text-sm font-medium bg-mint-500 text-white rounded-full hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isPublishing ? 'Publishing...' : 'Publish Event'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
