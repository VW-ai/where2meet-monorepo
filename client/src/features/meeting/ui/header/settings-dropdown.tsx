'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Edit2, CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUiVersion, type UiVersion } from '@/features/meeting/model/ui-version-store';
import { unpublishVenue } from '@/features/meeting/model/publish-venue';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    settings: 'Settings',
    edit: 'Edit Event',
    publishing: {
      classic: {
        unpublishing: 'Unpublishing...',
        unpublish: 'Unpublish Event',
        publish: 'Publish Event',
      },
      v2: {
        unpublishing: 'Changing...',
        unpublish: 'Change the spot',
      },
    } as Record<UiVersion, { unpublishing: string; unpublish: string; publish?: string }>,
    delete: 'Delete Event',
  },
  zh: {
    settings: '设置',
    edit: '编辑见面',
    publishing: {
      classic: { unpublishing: '正在撤销…', unpublish: '撤销确定地点', publish: '确定地点' },
      v2: { unpublishing: '正在更换…', unpublish: '更换地点' },
    },
    delete: '删除见面',
  },
});

interface SettingsDropdownProps {
  eventId: string;
}

export function SettingsDropdown({ eventId: _eventId }: SettingsDropdownProps) {
  const t = useMessages(messages);
  const publishing = t.publishing[useUiVersion()];
  const [isOpen, setIsOpen] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isOrganizerMode, organizerToken } = useAuthStore();
  const { openEditEventModal, openPublishModal, openDeleteConfirmation } = useUIStore();
  const { currentEvent } = useMeetingStore();

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
      await unpublishVenue(currentEvent.id, organizerToken);
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
        aria-label={t.settings}
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
            <span>{t.edit}</span>
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
              <span>{isUnpublishing ? publishing.unpublishing : publishing.unpublish}</span>
            </button>
          ) : (
            publishing.publish && (
              <button
                onClick={handlePublish}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 transition-colors border-t border-border"
              >
                <CheckCircle className="w-4 h-4 text-mint-500" />
                <span>{publishing.publish}</span>
              </button>
            )
          )}

          {/* Delete Event */}
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-border"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.delete}</span>
          </button>
        </div>
      )}
    </div>
  );
}
