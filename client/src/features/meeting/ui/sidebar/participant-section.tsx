'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useParticipantStore } from '@/features/meeting/model/participant-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { Users, Plus, BarChart3, UserPlus } from 'lucide-react';
import { AddParticipant, type ParticipantFormData } from './add-participant';
import { MyLocationPrompt, MY_LOCATION_INPUT_ID } from './my-location-prompt';
import { ParticipantPill } from './participant-pill';
import { participantClient } from '@/features/meeting/api';
import { cn } from '@/shared/lib/cn';
import type { Participant } from '@/entities';
import { analyticsEvents } from '@/lib/analytics/events';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    noToken: 'No authorization token available',
    saveFailed: 'Unable to save participant. Please check the address and try again.',
    deleteFailed: 'Failed to delete participant',
    title: 'Participants',
    count: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    statsLabel: 'View travel time statistics',
    statsTitle: 'Travel time stats',
    addDisabled: 'Cannot add participants after event is published',
    addParticipant: 'Add Participant',
    joinDisabled: 'Cannot join after event is published',
    joinEvent: 'Join Event',
    added: (name: string) => `${name} added. Add the next person, or tap Done.`,
    done: 'Done',
    cancel: 'Cancel',
    error: 'Error',
    dismissError: 'Dismiss error',
    emptyTitle: 'No participants yet',
    emptyHint: 'Add participants to find the perfect meeting spot',
    leaveTitle: 'Leave Event',
    deleteTitle: 'Delete Participant',
    leaveConfirm:
      'Are you sure you want to leave this event? You can rejoin later with a new registration.',
    removeConfirm: (name: ReactNode) => (
      <>Are you sure you want to remove {name}? This action cannot be undone.</>
    ),
    leave: 'Leave',
    delete: 'Delete',
  },
  zh: {
    noToken: '缺少授权信息',
    saveFailed: '参与者没能保存，请检查地址后重试。',
    deleteFailed: '参与者删除失败',
    title: '参与者',
    count: (n: number) => `${n} 人`,
    statsLabel: '查看路程时间统计',
    statsTitle: '路程时间统计',
    addDisabled: '地点已确定，不能再添加参与者',
    addParticipant: '添加参与者',
    joinDisabled: '地点已确定，不能再加入',
    joinEvent: '加入见面',
    added: (name: string) => `已添加${name}。继续添加下一位，或点“完成”。`,
    done: '完成',
    cancel: '取消',
    error: '出错了',
    dismissError: '关闭错误提示',
    emptyTitle: '还没有参与者',
    emptyHint: '添加参与者，一起找到最合适的见面地点',
    leaveTitle: '退出见面',
    deleteTitle: '删除参与者',
    leaveConfirm: '确定要退出这次见面吗？之后可以重新加入。',
    removeConfirm: (name: ReactNode) => <>确定要移除{name}吗？此操作无法撤销。</>,
    leave: '退出',
    delete: '删除',
  },
});

export function ParticipantSection() {
  const { currentEvent, selectedVenue, setCurrentEvent } = useMeetingStore();
  const { addParticipant, updateParticipant, removeParticipant } = useParticipantStore();
  const { selectedParticipantId, setSelectedParticipantId, routes } = useMapStore();
  const {
    isOrganizerMode,
    organizerToken,
    isParticipantMode,
    participantToken,
    currentParticipantId,
    organizerParticipantId,
    setParticipantInfo,
    clearParticipantInfo,
  } = useAuthStore();
  const { toggleParticipantStats } = useUIStore();
  const t = useMessages(messages);
  const locale = useLocale();

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
  // Organizers usually add several people in a row: the form stays open after each add
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const participantCount = currentEvent?.participants?.length || 0;
  const isPublished = !!currentEvent?.publishedAt;

  // The viewer's own participant record, if they have one in this event
  const myParticipantId = organizerParticipantId || currentParticipantId;
  const me = currentEvent?.participants?.find((p) => p.id === myParticipantId);
  const iNeedLocation = !!me && !me.address && !isPublished;

  // Save the viewer's own starting point from the inline prompt
  const handleSaveMyLocation = async (data: { name?: string; address: string }) => {
    if (!currentEvent || !me) return;
    const token = isOrganizerMode ? organizerToken : participantToken;
    if (!token) throw new Error(t.noToken);

    const updated = await participantClient.update(currentEvent.id, me.id, data, token);
    updateParticipant(me.id, updated);
    setCurrentEvent({
      ...currentEvent,
      participants: (currentEvent.participants ?? []).map((p) =>
        p.id === me.id ? { ...p, ...updated } : p
      ),
    });
    analyticsEvents.addLocation(currentEvent.id, data.address);
  };

  // "Add starting location" on your own card jumps to the prompt above the list
  const focusMyLocationPrompt = () => {
    const input = document.getElementById(MY_LOCATION_INPUT_ID);
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  };

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeletingParticipantId(null);
  }, []);

  // Cancel form
  const handleCancelForm = useCallback(() => {
    setShowAddForm(false);
    setEditingParticipant(null);
    setLastAddedName(null);
    setErrorMessage(null);
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
          throw new Error(t.noToken);
        }

        const updatedParticipant = await participantClient.update(
          currentEvent.id,
          editingParticipant.id,
          {
            name: data.name,
            address: data.address,
          },
          token
        );

        // Update local stores (both participant store and currentEvent.participants)
        updateParticipant(editingParticipant.id, updatedParticipant);
        if (currentEvent.participants) {
          setCurrentEvent({
            ...currentEvent,
            participants: currentEvent.participants.map((p) =>
              p.id === editingParticipant.id ? { ...p, ...updatedParticipant } : p
            ),
          });
        }

        // Track location update if address changed
        if (data.address && data.address !== editingParticipant.address) {
          analyticsEvents.addLocation(currentEvent.id, data.address);
        }

        setEditingParticipant(null);
      } else {
        // Create new participant via API
        if (isOrganizerMode && organizerToken) {
          // Organizer adds a participant
          const newParticipant = await participantClient.add(
            currentEvent.id,
            {
              name: data.name,
              address: data.address,
            },
            organizerToken
          );

          // Add to local stores (both participant store and currentEvent.participants)
          addParticipant(newParticipant);
          if (currentEvent.participants) {
            setCurrentEvent({
              ...currentEvent,
              participants: [...currentEvent.participants, newParticipant],
            });
          } else {
            setCurrentEvent({
              ...currentEvent,
              participants: [newParticipant],
            });
          }

          // Track participant added by organizer
          analyticsEvents.addLocation(currentEvent.id, data.address);

          // Keep the form open with fresh fields for the next person
          setLastAddedName(newParticipant.name);
          setFormKey((key) => key + 1);
          return;
        } else {
          // Self-registration (user joins themselves)
          const response = await participantClient.join(currentEvent.id, {
            name: data.name,
            address: data.address,
          });

          // Store participant token for self-management
          if (response.participantToken) {
            setParticipantInfo(currentEvent.id, response.id, response.participantToken);
          }

          // Add to local stores (strip the token before storing)
          const { participantToken: _, ...participant } = response;
          addParticipant(participant as Participant);
          if (currentEvent.participants) {
            setCurrentEvent({
              ...currentEvent,
              participants: [...currentEvent.participants, participant as Participant],
            });
          } else {
            setCurrentEvent({
              ...currentEvent,
              participants: [participant as Participant],
            });
          }

          // Track participant self-join
          analyticsEvents.joinEvent(currentEvent.id, response.id);
          analyticsEvents.addLocation(currentEvent.id, data.address);
        }
      }

      // Close form
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving participant:', error);
      setErrorMessage(participantErrorMessage(error, t.saveFailed, locale));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit participant
  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipant(participant);
    setLastAddedName(null);
    setErrorMessage(null);
    setFormKey((key) => key + 1);
    setShowAddForm(true);
  };

  const canManage = (participant: Participant) =>
    !isPublished &&
    (isOrganizerMode || (isParticipantMode && participant.id === currentParticipantId));

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
      await participantClient.remove(currentEvent.id, deletingParticipantId, token);

      // If deleting own participant, clear the token
      if (deletingParticipantId === currentParticipantId) {
        clearParticipantInfo(currentEvent.id);
      }

      // Remove from local stores (both participant store and currentEvent.participants)
      removeParticipant(deletingParticipantId);
      if (currentEvent.participants) {
        setCurrentEvent({
          ...currentEvent,
          participants: currentEvent.participants.filter((p) => p.id !== deletingParticipantId),
        });
      }
      setDeletingParticipantId(null);
    } catch (error) {
      console.error('Error deleting participant:', error);
      setErrorMessage(error instanceof Error ? error.message : t.deleteFailed);
      setDeletingParticipantId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t.title}
        </h2>
        <div className="flex items-center gap-2">
          {participantCount > 0 && (
            <span className="text-sm text-muted-foreground">{t.count(participantCount)}</span>
          )}
          {/* Stats button */}
          <button
            data-tutorial="stats-button"
            onClick={toggleParticipantStats}
            className="p-1.5 rounded-lg hover:bg-coral-50 text-muted-foreground hover:text-coral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500/20"
            aria-label={t.statsLabel}
            title={t.statsTitle}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prompt for the viewer's own starting point (organizers start without one) */}
      {!showAddForm && iNeedLocation && me && (
        <MyLocationPrompt
          askName={me.isOrganizer && me.name === 'Organizer'}
          onSubmit={handleSaveMyLocation}
        />
      )}

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
          title={isPublished ? t.addDisabled : undefined}
        >
          <Plus className="w-4 h-4" />
          {t.addParticipant}
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
          title={isPublished ? t.joinDisabled : undefined}
        >
          <UserPlus className="w-4 h-4" />
          {t.joinEvent}
        </button>
      )}

      {/* Add/Edit Participant Form */}
      {showAddForm && (
        <div className="space-y-3">
          <div className="p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-xl ring-2 ring-coral-500/30">
            <AddParticipant
              key={formKey}
              onSubmit={handleSubmitParticipant}
              onCancel={handleCancelForm}
              isSubmitting={isSubmitting}
              notice={lastAddedName ? t.added(lastAddedName) : null}
              cancelLabel={lastAddedName ? t.done : t.cancel}
              mode={editingParticipant ? 'edit' : 'add'}
              initialData={
                editingParticipant
                  ? {
                      name: editingParticipant.name,
                      address: editingParticipant.address || '',
                      placeId: '',
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
                <p className="text-sm font-medium text-red-900">{t.error}</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                aria-label={t.dismissError}
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
              isYou={participant.id === myParticipantId}
              // Organizer can edit/delete anyone, a participant only themselves (leave).
              // Disabled when event is published
              onEdit={canManage(participant) ? () => handleEditParticipant(participant) : undefined}
              onAddLocation={
                participant.id === myParticipantId && iNeedLocation
                  ? () => {
                      handleCancelForm();
                      setTimeout(focusMyLocationPrompt, 50);
                    }
                  : undefined
              }
              onDelete={
                canManage(participant) ? () => handleDeleteParticipant(participant.id) : undefined
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
            <p className="text-sm font-medium text-foreground mb-1">{t.emptyTitle}</p>
            <p className="text-xs text-muted-foreground">{t.emptyHint}</p>
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
                {deletingParticipantId === currentParticipantId ? t.leaveTitle : t.deleteTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {deletingParticipantId === currentParticipantId
                  ? t.leaveConfirm
                  : t.removeConfirm(
                      <span className="font-medium text-foreground">
                        {
                          currentEvent?.participants?.find((p) => p.id === deletingParticipantId)
                            ?.name
                        }
                      </span>
                    )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-full hover:bg-red-600 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {deletingParticipantId === currentParticipantId ? t.leave : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
