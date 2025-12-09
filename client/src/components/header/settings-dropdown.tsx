'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Edit2, CheckCircle, Trash2 } from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { cn } from '@/lib/utils/cn';

interface SettingsDropdownProps {
  eventId: string;
}

export function SettingsDropdown({ eventId: _eventId }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isOrganizerMode, openEditEventModal, openPublishModal, openDeleteConfirmation } =
    useUIStore();

  // Don't render if not in organizer mode
  if (!isOrganizerMode) return null;

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

  const handleEdit = () => {
    setIsOpen(false);
    openEditEventModal();
  };

  const handlePublish = () => {
    setIsOpen(false);
    openPublishModal();
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

          {/* Publish Event */}
          <button
            onClick={handlePublish}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 transition-colors border-t border-border"
          >
            <CheckCircle className="w-4 h-4 text-mint-500" />
            <span>Publish Event</span>
          </button>

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
