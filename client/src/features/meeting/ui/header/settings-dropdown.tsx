'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Edit2, CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { eventClient } from '@/features/meeting/api';
import { cn } from '@/shared/lib/cn';

interface SettingsDropdownProps {
  eventId: string;
}

export function SettingsDropdown({ eventId: _eventId }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isOrganizerMode, organizerToken } = useAuthStore();
  const { openEditEventModal, openPublishModal, openDeleteConfirmation } = useUIStore();
  const { currentEvent, setCurrentEvent } = useMeetingStore();

  const isPublished = !!currentEvent?.publishedAt;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't render if not in organizer mode
  if (!isOrganizerMode) return null;

  const handleEdit = () => {
    setIsOpen(false);
    openEditEventModal();
  };

  const handlePublish = () => {
    setIsOpen(false);
    openPublishModal();
  };

  const handleUnpublish = async () => {
    if (!currentEvent || !organizerToken) return;

    setIsUnpublishing(true);
    try {
      const updatedEvent = await eventClient.unpublish(currentEvent.id, organizerToken);
      setCurrentEvent(updatedEvent);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to unpublish event:', error);
      // Could add toast notification here for error feedback
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleDelete = () => {
    setIsOpen(false);
    openDeleteConfirmation();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'p-3 md:p-2 rounded-full transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
          isOpen
            ? 'bg-coral-500 text-white'
            : 'bg-white text-muted-foreground border border-border hover:border-coral-500 hover:text-coral-500'
        )}
        aria-label="Settings"
        aria-expanded={isOpen}
      >
        <Settings className="w-5 h-5 md:w-4 md:h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-border shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Edit Event */}
          <button
            onClick={handleEdit}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-muted-foreground" />
            <span>Edit Event</span>
          </button>

          {/* Publish/Unpublish Event */}
          {isPublished ? (
            <button
              onClick={handleUnpublish}
              disabled={isUnpublishing}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 transition-colors border-t border-border disabled:opacity-50"
            >
              {isUnpublishing ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 text-orange-500" />
              )}
              <span>{isUnpublishing ? 'Unpublishing...' : 'Unpublish Event'}</span>
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 transition-colors border-t border-border"
            >
              <CheckCircle className="w-4 h-4 text-mint-500" />
              <span>Publish Event</span>
            </button>
          )}

          {/* Delete Event */}
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-border"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Event</span>
          </button>
        </div>
      )}
    </div>
  );
}
