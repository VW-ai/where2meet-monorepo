'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle } from 'lucide-react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useUIStore } from '@/store/ui-store';

export function DeleteEventModal() {
  const router = useRouter();
  const { isDeleteConfirmationOpen, closeDeleteConfirmation } = useUIStore();
  const { currentEvent, reset } = useMeetingStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Reset confirm text when modal opens
  useEffect(() => {
    if (isDeleteConfirmationOpen) {
      setConfirmText('');
    }
  }, [isDeleteConfirmationOpen]);

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDeleteConfirmation();
      }
    },
    [closeDeleteConfirmation]
  );

  useEffect(() => {
    if (isDeleteConfirmationOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDeleteConfirmationOpen, handleEscape]);

  const handleDelete = async () => {
    if (!currentEvent || confirmText !== 'DELETE') return;

    setIsDeleting(true);

    try {
      // Reset the store (clears current event)
      reset();

      closeDeleteConfirmation();

      // Redirect to home page
      router.push('/');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isDeleteConfirmationOpen) return null;

  const eventTitle = currentEvent?.title || 'this event';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeDeleteConfirmation}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Delete Event</h2>
          </div>
          <button
            onClick={closeDeleteConfirmation}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{eventTitle}</span>? This action cannot be
            undone and all participants will lose access.
          </p>

          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm text-red-700 mb-3">
              Type <span className="font-mono font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2.5 rounded-lg border-2 border-red-200 bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 transition-colors font-mono"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={closeDeleteConfirmation}
            className="flex-1 px-4 py-3 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== 'DELETE'}
            className="flex-1 px-4 py-3 text-sm font-medium bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isDeleting ? 'Deleting...' : 'Delete Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
