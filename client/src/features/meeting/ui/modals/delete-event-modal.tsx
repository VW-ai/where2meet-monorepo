'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle } from 'lucide-react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { eventClient } from '@/features/meeting/api';
import { APIError } from '@/lib/api/client';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    noPermission: "You don't have permission to delete this event",
    failed: 'Failed to delete event',
    fallbackTitle: 'this event',
    title: 'Delete Event',
    close: 'Close',
    confirmBefore: 'Are you sure you want to delete',
    confirmAfter: '? This action cannot be undone and all participants will lose access.',
    typePrefix: 'Type ',
    typeSuffix: ' to confirm:',
    placeholder: 'Type DELETE',
    cancel: 'Cancel',
    deleting: 'Deleting...',
  },
  zh: {
    noPermission: '你没有删除这个见面的权限',
    failed: '删除失败',
    fallbackTitle: '这个见面',
    title: '删除见面',
    close: '关闭',
    confirmBefore: '确定要删除',
    confirmAfter: '吗？删除后无法恢复，所有参与者都将无法再访问。',
    typePrefix: '输入 ',
    typeSuffix: ' 以确认：',
    placeholder: '输入 DELETE',
    cancel: '取消',
    deleting: '正在删除…',
  },
});

export function DeleteEventModal() {
  const t = useMessages(messages);
  const router = useRouter();
  const { isDeleteConfirmationOpen, closeDeleteConfirmation } = useUIStore();
  const { organizerToken, clearOrganizerToken } = useAuthStore();
  const { currentEvent, reset } = useMeetingStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset confirm text and error when modal opens
  useEffect(() => {
    if (isDeleteConfirmationOpen) {
      setConfirmText('');
      setError(null);
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
    if (!currentEvent || confirmText !== 'DELETE' || !organizerToken) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Call backend API with token
      await eventClient.delete(currentEvent.id, organizerToken);

      // Clear local token from localStorage
      localStorage.removeItem(`organizer_token_${currentEvent.id}`);

      // Reset the store (clears current event)
      reset();
      clearOrganizerToken();
      closeDeleteConfirmation();

      // Redirect to home page
      router.push('/');
    } catch (err) {
      if (err instanceof APIError) {
        if (err.status === 401 || err.status === 403) {
          setError(t.noPermission);
          clearOrganizerToken();
        } else {
          setError(err.message);
        }
      } else {
        setError(t.failed);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isDeleteConfirmationOpen) return null;

  const eventTitle = currentEvent?.title || t.fallbackTitle;

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
            <h2 className="text-xl font-semibold text-foreground">{t.title}</h2>
          </div>
          <button
            onClick={closeDeleteConfirmation}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t.confirmBefore} <span className="font-medium text-foreground">{eventTitle}</span>
            {t.confirmAfter}
          </p>

          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm text-red-700 mb-3">
              {t.typePrefix}
              <span className="font-mono font-bold">DELETE</span>
              {t.typeSuffix}
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t.placeholder}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-red-200 bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 transition-colors font-mono"
              autoComplete="off"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={closeDeleteConfirmation}
            className="flex-1 px-4 py-3 text-sm font-medium bg-white border-2 border-border text-foreground rounded-full hover:bg-gray-50 transition-all duration-200"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== 'DELETE' || !organizerToken}
            className="flex-1 px-4 py-3 text-sm font-medium bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isDeleting ? t.deleting : t.title}
          </button>
        </div>
      </div>
    </div>
  );
}
