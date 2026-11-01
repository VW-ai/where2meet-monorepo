'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, MapPin, AlertCircle } from 'lucide-react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { eventClient } from '@/features/meeting/api';
import { APIError } from '@/lib/api/client';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    alreadyPublished: 'This event has already been published.',
    unverifiedVenue: 'The selected venue could not be verified. Please try another venue.',
    unexpected: 'An unexpected error occurred. Please try again.',
    published: 'Event Published!',
    notified: 'Participants have been notified of the final venue.',
    title: 'Publish Event',
    close: 'Close',
    description:
      'Publishing this event will finalize the meeting location and notify all participants.',
    noVenue: 'No venue selected. Select a venue before publishing to include a location.',
    cancel: 'Cancel',
    publishing: 'Publishing...',
  },
  zh: {
    alreadyPublished: '这个见面已经确定地点了。',
    unverifiedVenue: '无法核实所选地点，请换一个地点试试。',
    unexpected: '出了点问题，请重试。',
    published: '地点已确定！',
    notified: '已通知所有参与者最终地点。',
    title: '确定地点',
    close: '关闭',
    description: '确定后，见面地点将定下来，并通知所有参与者。',
    noVenue: '还没有选择地点。请先选一个地点再确定。',
    cancel: '取消',
    publishing: '正在确定…',
  },
});

export function PublishEventModal() {
  const t = useMessages(messages);
  const { isPublishModalOpen, closePublishModal, setActiveView } = useUIStore();
  const { organizerToken } = useAuthStore();
  const { currentEvent, selectedVenue, setCurrentEvent } = useMeetingStore();
  const { voteForVenue, hasVotedFor } = useVotingStore();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isPublishModalOpen) {
      setIsPublished(false);
      setError(null);
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
    if (!currentEvent || !selectedVenue || !organizerToken) return;

    setIsPublishing(true);
    setError(null);

    try {
      // Step 1: Check if organizer has already voted for this venue
      const alreadyVoted = hasVotedFor(selectedVenue.id);

      // Step 2: If not voted, vote first before publishing
      if (!alreadyVoted) {
        try {
          await voteForVenue(currentEvent.id, selectedVenue.id, {
            name: selectedVenue.name,
            address: selectedVenue.address,
            lat: selectedVenue.location.lat,
            lng: selectedVenue.location.lng,
            category: selectedVenue.types?.[0],
            rating: selectedVenue.rating ?? undefined,
            priceLevel: selectedVenue.priceLevel ?? undefined,
            photoUrl: selectedVenue.photoUrl ?? undefined,
          });
          console.log(
            '[PublishEventModal] Organizer voted for venue before publishing:',
            selectedVenue.id
          );
        } catch (voteError) {
          // 409 Conflict means organizer already voted (race condition with local state)
          if (voteError instanceof APIError && voteError.status === 409) {
            console.log(
              '[PublishEventModal] Organizer already voted (409 - continuing to publish)'
            );
          } else {
            // Other vote errors are logged but don't fail the publish operation
            console.error(
              '[PublishEventModal] Failed to vote before publishing (continuing anyway):',
              voteError
            );
          }
        }
      } else {
        console.log(
          '[PublishEventModal] Organizer already voted, proceeding to publish:',
          selectedVenue.id
        );
      }

      // Step 3: Now publish the event
      const updatedEvent = await eventClient.publish(
        currentEvent.id,
        selectedVenue.id,
        organizerToken
      );

      // Update local state with the returned event data
      setCurrentEvent(updatedEvent);

      // Switch to venue view to show published venue in liked venues section
      setActiveView('venue');

      setIsPublished(true);

      // Auto close after 2 seconds
      setTimeout(() => {
        closePublishModal();
      }, 2000);
    } catch (err) {
      if (err instanceof APIError) {
        if (err.code === 'EVENT_ALREADY_PUBLISHED') {
          setError(t.alreadyPublished);
        } else if (err.code === 'VALIDATION_ERROR') {
          // The backend rejects a venue it can't verify with Google Places as invalid input
          setError(t.unverifiedVenue);
        } else {
          setError(err.message);
        }
      } else {
        setError(t.unexpected);
      }
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
            <h2 className="text-xl font-semibold text-foreground mb-2">{t.published}</h2>
            <p className="text-sm text-muted-foreground">{t.notified}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">{t.title}</h2>
              <button
                onClick={closePublishModal}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={t.close}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.description}</p>

              {error && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

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
                  <p className="text-sm text-yellow-700">{t.noVenue}</p>
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
                {t.cancel}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !selectedVenue}
                className="flex-1 px-4 py-3 text-sm font-medium bg-mint-500 text-white rounded-full hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isPublishing ? t.publishing : t.title}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
