'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useMapStore } from '@/store/map-store';
import { useUIStore } from '@/store/ui-store';
import { Users, Plus, BarChart3, UserPlus } from 'lucide-react';
import { AddParticipant, type ParticipantFormData } from './participant/add-participant';
import { ParticipantPill } from './participant/participant-pill';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import type { Participant } from '@/types';

export function ParticipantSection() {
  const { currentEvent, addParticipant, updateParticipant, removeParticipant, selectedVenue } =
    useMeetingStore();
  const { selectedParticipantId, setSelectedParticipantId, routes } = useMapStore();
  const {
    isOrganizerMode,
    organizerToken,
    isParticipantMode,
    participantToken,
    currentParticipantId,
    setParticipantInfo,
    clearParticipantInfo,
    toggleParticipantStats,
  } = useUIStore();

  // Helper to get travel time for a participant from calculated routes
  const getTravelTime = (participantId: string): string | undefined => {
    if (!selectedVenue || routes.length === 0) return undefined;
    const route = routes.find((r) => r.participantId === participantId);
    return route?.duration;
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingParticipantId, setDeletingParticipantId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const participantCount = currentEvent?.participants?.length || 0;
  const isPublished = !!currentEvent?.publishedAt;

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeletingParticipantId(null);
  }, []);

  // Cancel form
  const handleCancelForm = useCallback(() => {
    setShowAddForm(false);
    setEditingParticipant(null);
  }, []);

  // Keyboard event handler for Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingParticipantId) {
          cancelDelete();
        } else if (showAddForm) {
          handleCancelForm();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deletingParticipantId, showAddForm, cancelDelete, handleCancelForm]);

  // Handle participant form submission (add or edit)
  const handleSubmitParticipant = async (data: ParticipantFormData) => {
    if (!currentEvent) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingParticipant) {
        // Update existing participant via API
        const token = isOrganizerMode ? organizerToken : participantToken;
        if (!token) {
          throw new Error('No authorization token available');
        }

        const updatedParticipant = await api.participants.update(
          currentEvent.id,
          editingParticipant.id,
          {
            name: data.name,
            address: data.address,
            fuzzyLocation: data.fuzzyLocation,
          },
          token
        );

        // Update local store
        updateParticipant(editingParticipant.id, updatedParticipant);
        setEditingParticipant(null);
      } else {
        // Create new participant via API
        if (isOrganizerMode && organizerToken) {
          // Organizer adds a participant
          const newParticipant = await api.participants.add(
            currentEvent.id,
            {
              name: data.name,
              address: data.address,
              fuzzyLocation: data.fuzzyLocation,
            },
            organizerToken
          );

          // Add to local store
          addParticipant(newParticipant);
        } else {
          // Self-registration (user joins themselves)
          const response = await api.participants.join(currentEvent.id, {
            name: data.name,
            address: data.address,
            fuzzyLocation: data.fuzzyLocation,
          });

          // Store participant token for self-management
          if (response.participantToken) {
            setParticipantInfo(currentEvent.id, response.id, response.participantToken);
          }

          // Add to local store (strip the token before storing)
          const { participantToken: _, ...participant } = response;
          addParticipant(participant as Participant);
        }
      }

      // Close form
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving participant:', error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Unable to save participant. Please check the address and try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit participant
  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipant(participant);
    setShowAddForm(true);
  };

  // Handle delete participant
  const handleDeleteParticipant = (id: string) => {
    setDeletingParticipantId(id);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deletingParticipantId || !currentEvent) return;

    try {
      // Determine which token to use
      const token = isOrganizerMode ? organizerToken : participantToken;
      if (!token) {
        throw new Error('No authorization token available');
      }

      // Call API to delete
      await api.participants.remove(currentEvent.id, deletingParticipantId, token);

      // If deleting own participant, clear the token
      if (deletingParticipantId === currentParticipantId) {
        clearParticipantInfo(currentEvent.id);
      }

      // Remove from local store
      removeParticipant(deletingParticipantId);
      setDeletingParticipantId(null);
    } catch (error) {
      console.error('Error deleting participant:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete participant');
      setDeletingParticipantId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" />
          Participants
        </h2>
        <div className="flex items-center gap-2">
          {participantCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {participantCount} {participantCount === 1 ? 'person' : 'people'}
            </span>
          )}
          {/* Stats button */}
          <button
            onClick={toggleParticipantStats}
            className="p-1.5 rounded-lg hover:bg-coral-50 text-muted-foreground hover:text-coral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500/20"
            aria-label="View travel time statistics"
            title="Travel time stats"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add Participant Button (organizer mode) */}
      {!showAddForm && isOrganizerMode && (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={isPublished}
          className={cn(
            'w-full px-4 py-3 bg-white/90 backdrop-blur-sm border-2 border-border shadow-lg rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium',
            isPublished
              ? 'opacity-50 cursor-not-allowed text-muted-foreground'
              : 'hover:shadow-xl hover:bg-coral-50/90 hover:border-coral-500 text-muted-foreground hover:text-coral-600'
          )}
          title={isPublished ? 'Cannot add participants after event is published' : undefined}
        >
          <Plus className="w-4 h-4" />
          Add Participant
        </button>
      )}

      {/* Join Event Button (non-organizer, not yet joined) */}
      {!showAddForm && !isOrganizerMode && !isParticipantMode && (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={isPublished}
          className={cn(
            'w-full px-4 py-3 shadow-lg rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium',
            isPublished
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-coral-500 text-white hover:shadow-xl hover:bg-coral-600'
          )}
          title={isPublished ? 'Cannot join after event is published' : undefined}
        >
          <UserPlus className="w-4 h-4" />
          Join Event
        </button>
      )}

      {/* Add/Edit Participant Form */}
      {showAddForm && (
        <div className="space-y-3">
          <div className="p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-xl ring-2 ring-coral-500/30">
            <AddParticipant
              onSubmit={handleSubmitParticipant}
              onCancel={handleCancelForm}
              isSubmitting={isSubmitting}
              mode={editingParticipant ? 'edit' : 'add'}
              initialData={
                editingParticipant
                  ? {
                      name: editingParticipant.name,
                      address: editingParticipant.address || '',
                      placeId: '',
                      fuzzyLocation: editingParticipant.fuzzyLocation ?? false,
                    }
                  : undefined
              }
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                aria-label="Dismiss error"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Participant List */}
      {participantCount > 0 && (
        <div className="space-y-3 overflow-visible">
          {currentEvent?.participants?.map((participant) => (
            <ParticipantPill
              key={participant.id}
              participant={participant}
              travelTime={getTravelTime(participant.id)}
              onClick={() => {
                // Toggle selection - if already selected, deselect; otherwise select
                if (selectedParticipantId === participant.id) {
                  setSelectedParticipantId(null);
                } else {
                  setSelectedParticipantId(participant.id);
                }
              }}
              onEdit={
                // Organizer can edit anyone, participant can only edit themselves
                // Disabled when event is published
                !isPublished &&
                (isOrganizerMode || (isParticipantMode && participant.id === currentParticipantId))
                  ? () => handleEditParticipant(participant)
                  : undefined
              }
              onDelete={
                // Organizer can delete anyone, participant can only delete themselves (leave)
                // Disabled when event is published
                !isPublished &&
                (isOrganizerMode || (isParticipantMode && participant.id === currentParticipantId))
                  ? () => handleDeleteParticipant(participant.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Empty State (when no participants) */}
      {participantCount === 0 && !showAddForm && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-coral-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-coral-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">No participants yet</p>
            <p className="text-xs text-muted-foreground">
              Add participants to find the perfect meeting spot
            </p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingParticipantId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={cancelDelete}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {deletingParticipantId === currentParticipantId
                  ? 'Leave Event'
                  : 'Delete Participant'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {deletingParticipantId === currentParticipantId ? (
                  'Are you sure you want to leave this event? You can rejoin later with a new registration.'
                ) : (
                  <>
                    Are you sure you want to remove{' '}
                    <span className="font-medium text-foreground">
                      {
                        currentEvent?.participants?.find((p) => p.id === deletingParticipantId)
                          ?.name
                      }
                    </span>
                    ? This action cannot be undone.
                  </>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-full hover:bg-red-600 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {deletingParticipantId === currentParticipantId ? 'Leave' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
