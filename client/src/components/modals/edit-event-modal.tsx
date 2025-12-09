'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useUIStore } from '@/store/ui-store';

export function EditEventModal() {
  const { isEditEventModalOpen, closeEditEventModal } = useUIStore();
  const { currentEvent, updateEvent } = useMeetingStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with current event data
  useEffect(() => {
    if (currentEvent && isEditEventModalOpen) {
      setTitle(currentEvent.title || '');
      if (currentEvent.meetingTime) {
        const eventDate = new Date(currentEvent.meetingTime);
        setDate(eventDate.toISOString().split('T')[0]);
        setTime(eventDate.toTimeString().slice(0, 5));
      }
    }
  }, [currentEvent, isEditEventModalOpen]);

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeEditEventModal();
      }
    },
    [closeEditEventModal]
  );

  useEffect(() => {
    if (isEditEventModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isEditEventModalOpen, handleEscape]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !title.trim()) return;

    setIsSubmitting(true);

    try {
      // Combine date and time
      let meetingTime: string | undefined;
      if (date && time) {
        meetingTime = new Date(`${date}T${time}`).toISOString();
      } else if (date) {
        meetingTime = new Date(date).toISOString();
      }

      updateEvent({
        title: title.trim(),
        meetingTime,
      });

      closeEditEventModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEditEventModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeEditEventModal}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Edit Event</h2>
          <button
            onClick={closeEditEventModal}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Title */}
          <div>
            <label
              htmlFor="event-title"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Event Title
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-coral-500 transition-colors"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="event-date"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Date
            </label>
            <input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-foreground focus:outline-none focus:border-coral-500 transition-colors"
            />
          </div>

          {/* Time */}
          <div>
            <label
              htmlFor="event-time"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Time
            </label>
            <input
              id="event-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-foreground focus:outline-none focus:border-coral-500 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={closeEditEventModal}
              className="flex-1 px-4 py-3 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 px-4 py-3 text-sm font-medium bg-coral-500 text-white rounded-full hover:bg-coral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
