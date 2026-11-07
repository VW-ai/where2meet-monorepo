import { create } from 'zustand';
import type { DraftPerson } from '@/features/meeting/lib/add-person-form';

interface DraftPersonState {
  draft: DraftPerson | null;
  setDraft: (draft: DraftPerson | null) => void;
}

export const useDraftPersonStore = create<DraftPersonState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));
