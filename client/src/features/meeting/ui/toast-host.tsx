'use client';

import { useToastStore } from '@/features/meeting/model/toast-store';

export function ToastHost() {
  const { toast, dismissToast } = useToastStore();
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[70] flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-full bg-v2-ink py-[9px] pl-4 pr-2.5 text-[13px] text-white shadow-[0_1px_2px_rgba(33,37,43,.06),0_12px_32px_rgba(33,37,43,.14)]"
    >
      <span className="pr-1.5">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="flex-none px-1.5 font-semibold text-[#ff8a8f]"
          onClick={() => {
            dismissToast();
            toast.action?.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
