'use client';

import { useEffect } from 'react';
import { isUiVersionToggle, useUiVersionStore } from '@/features/meeting/model/ui-version-store';

/** Applies `?ui=` or the saved version, and flips it on Shift+Alt+U with no visible control. */
export function useUiVersionSwitch() {
  useEffect(() => {
    const { loadVersion, toggleVersion } = useUiVersionStore.getState();
    loadVersion(window.location.search);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isUiVersionToggle(event)) return;
      event.preventDefault();
      toggleVersion();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
