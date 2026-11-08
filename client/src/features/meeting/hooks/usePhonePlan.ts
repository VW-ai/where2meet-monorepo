'use client';

import { useSyncExternalStore } from 'react';
import { useUiVersion } from '@/features/meeting/model/ui-version-store';

const PHONE_QUERY = '(max-width: 767px)';

function subscribe(listener: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** The phone flow replaces the floating sidebar on narrow screens. Classic keeps its own layout. */
export function usePhonePlan(): boolean {
  const phone = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
  const version = useUiVersion();
  return phone && version === 'v2';
}
