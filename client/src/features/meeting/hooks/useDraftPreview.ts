'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { participantClient } from '@/features/meeting/api';
import {
  toDraftPreview,
  type DraftPreview,
  type PickedPlace,
} from '@/features/meeting/lib/add-person-form';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';

/** Asks once per place and venue. An answer for anything else is never shown. */
export function useDraftPreview(place: PickedPlace | null): DraftPreview | null {
  const eventId = useMeetingStore((state) => state.currentEvent?.id);
  const venueId = useMeetingStore((state) => state.selectedVenue?.id);
  const token = useAuthStore((state) => state.organizerToken);
  const [answer, setAnswer] = useState<{ key: string; preview: DraftPreview } | null>(null);
  const address = place?.address;
  const key = eventId && token && place ? `${place.placeId}|${venueId ?? ''}` : null;

  useEffect(() => {
    if (!key || !eventId || !token || !address) return;
    let stale = false;
    participantClient
      .preview(eventId, { address, venueId }, token)
      .then((response) => {
        if (!stale) setAnswer({ key, preview: toDraftPreview(response, !!venueId) });
      })
      .catch((error) => {
        // Adding the person still works: the server geocodes again and reports its own errors
        console.error('[Preview] Could not preview this place:', error);
        if (!stale) setAnswer({ key, preview: { status: 'failed' } });
      });
    return () => {
      stale = true;
    };
  }, [key, eventId, token, address, venueId]);

  if (!key) return null;
  return answer?.key === key ? answer.preview : { status: 'loading' };
}
