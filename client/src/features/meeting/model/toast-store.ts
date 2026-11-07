import { create } from 'zustand';

const PLAIN_MS = 2200;
const WITH_ACTION_MS = 6000;

export interface Toast {
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toast: Toast | null;
  showToast: (toast: Toast) => void;
  dismissToast: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (toast) => {
    clearTimeout(timer);
    set({ toast });
    timer = setTimeout(() => set({ toast: null }), toast.action ? WITH_ACTION_MS : PLAIN_MS);
  },
  dismissToast: () => {
    clearTimeout(timer);
    set({ toast: null });
  },
}));
